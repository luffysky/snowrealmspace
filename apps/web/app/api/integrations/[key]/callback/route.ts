import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/session'
import { appUrl } from '@/lib/app-url'
import { openTx } from '@/lib/integrations/canva'
import { encryptToken, exchangeCode, isProviderKey, providerConfig } from '@/lib/integrations/providers'
import { getAdapter } from '@/lib/integrations/sync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CONNECT_COOKIE = 'sr_provider_connect'
const SETTINGS = '/settings/integrations'
/**
 * 取不到 provider 帳號識別（/me 端點暫時失敗等）時的備援 external_account_id。
 * 用固定 sentinel 而非隨機值：同一 (space, provider) 反覆備援只更新同一列、不堆垃圾。
 * 之後若成功取得真實帳號 id，會走「新增另一列」而非覆蓋此列。
 */
const UNRESOLVED_ACCOUNT_ID = '__unresolved__'

type ConnectTx = { provider: string; spaceId: string; userId: string; state: string; verifier: string | null; exp: number }

function back(origin: string, query: string): NextResponse {
  const res = NextResponse.redirect(new URL(`${SETTINGS}?${query}`, origin))
  res.cookies.delete(CONNECT_COOKIE) // 一次性
  return res
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

/**
 * 沒有 real-flow 暫存 cookie → 多半是後台「Canva Token 轉換器」的貼網址流程。
 * 不把使用者導走，改把 provider 回傳的 code/state 顯示出來供複製貼回轉換器。
 */
function manualCopyPage(fullUrl: string): NextResponse {
  const html = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>授權完成 — 複製網址</title>
<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:3rem auto;padding:0 1rem;line-height:1.6;color:#1a1a1a;background:#fafafa}
code{display:block;word-break:break-all;background:#fff;border:1px solid #ddd;border-radius:8px;padding:.75rem;margin:.5rem 0;user-select:all}
button{font:inherit;padding:.5rem 1rem;border-radius:999px;border:1px solid #ccc;background:#fff;cursor:pointer}</style></head>
<body><h1>授權已完成</h1>
<p>把下面這整條網址複製，貼回後台的 <strong>Canva Token 轉換器</strong>「貼回導回的網址」欄位，按換取 Token。</p>
<code id="u">${esc(fullUrl)}</code>
<button onclick="navigator.clipboard.writeText(document.getElementById('u').textContent).then(()=>{this.textContent='已複製'})">複製網址</button>
</body></html>`
  return new NextResponse(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } })
}

/**
 * Design provider 授權回呼（04-api-contract.md §7）。
 *
 * 瀏覽器導回（無自訂 header），故空間與使用者一律從連接時封存的 cookie 取回，
 * 並比對現在 session 的使用者。換 token 後加密存 design_connections（owner RLS）。
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const origin = appUrl()
  const { key } = await params
  const url = request.nextUrl
  const providerError = url.searchParams.get('error')
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state') ?? ''

  if (!isProviderKey(key)) return back(origin, 'error=unknown_provider')
  if (providerError) return back(origin, `error=denied&provider=${key}`)
  if (!code) return back(origin, `error=missing_code&provider=${key}`)

  const sealed = request.cookies.get(CONNECT_COOKIE)?.value
  // 沒有 real-flow 暫存 → 後台轉換器的貼網址流程：顯示 code 供複製，不導走。
  if (!sealed) return manualCopyPage(request.nextUrl.toString())

  const tx = openTx<ConnectTx>(sealed)
  if (!tx || tx.provider !== key) return back(origin, `error=state_lost&provider=${key}`)
  if (tx.exp < Date.now()) return back(origin, `error=expired&provider=${key}`)
  if (!state || state !== tx.state) return back(origin, `error=state_mismatch&provider=${key}`)

  // 現在的 session 使用者必須就是發起連接的人（cookie 不足以單獨授權寫入）
  const user = await getUser()
  if (!user || user.id !== tx.userId) return back(origin, `error=session_mismatch&provider=${key}`)

  const cfg = providerConfig(key)
  if (!cfg) return back(origin, `error=not_configured&provider=${key}`)

  const exchanged = await exchangeCode(cfg, code, tx.verifier)
  if (!exchanged.ok) {
    console.error(`[integrations/${key}/callback] 換 token 失敗`, exchanged.error)
    return back(origin, `error=exchange_failed&provider=${key}`)
  }

  const accessEnc = encryptToken(exchanged.tokens.accessToken)
  const refreshEnc = exchanged.tokens.refreshToken ? encryptToken(exchanged.tokens.refreshToken) : null
  if (!accessEnc || (exchanged.tokens.refreshToken && !refreshEnc)) {
    return back(origin, `error=no_encryption_key&provider=${key}`)
  }

  const scopes = exchanged.tokens.scope ? exchanged.tokens.scope.split(/\s+/).filter(Boolean) : [...cfg.scopes]
  const expiresAt = new Date(Date.now() + exchanged.tokens.expiresInSec * 1000).toISOString()

  // 問 provider「這是誰的帳號」→ 以帳號為 key 存連線，讓同 provider 多帳號並存。
  // 取不到（/me 暫時失敗）不放棄連接：退回穩定 sentinel 並記 log（不靜默漏掉連接）。
  let account: { externalId: string; label: string | null }
  try {
    account = await getAdapter(key).fetchAccount(exchanged.tokens.accessToken)
  } catch (err) {
    console.warn(
      `[integrations/${key}/callback] 取得帳號識別失敗，改用備援 id（連接仍會保存）`,
      err instanceof Error ? err.message : err,
    )
    account = { externalId: UNRESOLVED_ACCOUNT_ID, label: null }
  }

  const record = {
    access_token_encrypted: accessEnc,
    refresh_token_encrypted: refreshEnc,
    scopes,
    expires_at: expiresAt,
    status: 'active' as const,
    last_error: null,
    external_account_label: account.label,
  }

  const db = await getDb()
  // 以 (space, provider, external_account_id) 為 key：同帳號→更新（重新連接）、不同帳號→新增另一列。
  const { data: sameAccount } = await db
    .from('design_connections')
    .select('id')
    .eq('space_id', tx.spaceId)
    .eq('provider', key)
    .eq('external_account_id', account.externalId)
    .maybeSingle()

  if (sameAccount) {
    // 同一帳號重新連接：更新 token/scope/expiry/label/status。
    const { error } = await db
      .from('design_connections')
      .update({ ...record, external_account_id: account.externalId } as never)
      .eq('id', sameAccount.id)
    if (error) {
      console.error(`[integrations/${key}/callback] 更新連線失敗`, error.message)
      return back(origin, `error=save_failed&provider=${key}`)
    }
    return back(origin, `connected=${key}`)
  }

  // 沒有相符帳號 → 先看有沒有本功能之前留下的 external_account_id IS NULL 舊列，
  // 有就「就地補上帳號識別」（避免把使用者既有的連接變孤兒 / 重複建列）。
  const { data: legacy } = await db
    .from('design_connections')
    .select('id')
    .eq('space_id', tx.spaceId)
    .eq('provider', key)
    .is('external_account_id', null)
    .limit(1)
    .maybeSingle()

  if (legacy) {
    const { error } = await db
      .from('design_connections')
      .update({ ...record, external_account_id: account.externalId } as never)
      .eq('id', legacy.id)
    if (error) {
      console.error(`[integrations/${key}/callback] 補寫舊連線帳號識別失敗`, error.message)
      return back(origin, `error=save_failed&provider=${key}`)
    }
    return back(origin, `connected=${key}`)
  }

  // 全新帳號 → 新增一列（帶 external_account_id / label）。
  const { error } = await db
    .from('design_connections')
    .insert({ space_id: tx.spaceId, user_id: user.id, provider: key, external_account_id: account.externalId, ...record } as never)
  if (error) {
    console.error(`[integrations/${key}/callback] 建立連線失敗`, error.message)
    return back(origin, `error=save_failed&provider=${key}`)
  }

  return back(origin, `connected=${key}`)
}
