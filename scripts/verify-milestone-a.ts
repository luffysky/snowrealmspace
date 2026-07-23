/**
 * Milestone A 閉環驗證。
 *
 * 「受邀者能收到 magic link、登入、看到一個屬於自己的空 Space，
 *   登出再登入資料仍在。」
 *
 * 這支腳本走完整條路徑，包含從 Mailpit 取回真實的 magic link，
 * 而不是繞過 email 直接發 token —— 繞過的話就沒有驗證到寄信這一段。
 *
 * 前提：supabase 本機 stack 執行中、web dev server 在 :3000。
 */
import { config } from 'dotenv'

config({ path: '.env.local' })

const { createInvite } = await import('@snowrealm/db/provisioning')
const { createAdminClient } = await import('@snowrealm/db/server')

const APP = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const MAILPIT = 'http://127.0.0.1:54324'

// 站台密碼閘門：進站要先過。驗證腳本代表「已過閘門的瀏覽器」，
// 所以每個請求都帶上閘門 cookie，否則會被導去 /gate 而測不到 auth 流程。
// token 見 apps/web/lib/gate.ts（GATE_COOKIE / GATE_TOKEN）。
const GATE = 'sr-gate=granted-2607'
const withGate = (cookie?: string): string => (cookie ? `${GATE}; ${cookie}` : GATE)

const results: { step: string; ok: boolean; detail?: string }[] = []
function record(step: string, ok: boolean, detail?: string) {
  results.push(detail === undefined ? { step, ok } : { step, ok, detail })
  console.log(`${ok ? '✓' : '✗'} ${step}${detail ? ` — ${detail}` : ''}`)
}

const email = `milestone-a-${Date.now()}@example.com`
const db = createAdminClient()

// ── 1. 建立邀請 ──────────────────────────────────────────
const invite = await createInvite({ email })
record('建立邀請', Boolean(invite.token), email)

// ── 2. 未受邀的 email 不能取得 space ──────────────────────
{
  const res = await fetch(`${APP}/auth/callback?code=bogus-code`, {
    redirect: 'manual',
    headers: { cookie: GATE },
  })
  const location = res.headers.get('location') ?? ''
  record(
    '無效 code 被拒絕並導回登入頁',
    res.status >= 300 && res.status < 400 && location.includes('/login'),
    location.split('?')[1] ?? '',
  )
}

// ── 3. 真的寄出 magic link ────────────────────────────────
//
// 用 createUserClient + 自建 cookie jar，而不是普通的 createClient。
// 原因：@supabase/ssr 走 PKCE，signInWithOtp 會把 code verifier 存進 cookie，
// callback 的 exchangeCodeForSession 要讀回它。用無 cookie 的 client 會退回
// implicit flow，回傳 URL fragment 而非 ?code=，那就不是瀏覽器實際走的路徑了。
const callbackUrl = new URL('/auth/callback', APP)
callbackUrl.searchParams.set('next', '/home')
callbackUrl.searchParams.set('invite', invite.token)

const { createUserClient } = await import('@snowrealm/db/server')

/** 模擬瀏覽器的 cookie 儲存。 */
const jar = new Map<string, string>()
const browserClient = createUserClient({
  getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
  setAll: (toSet) => {
    for (const { name, value } of toSet) {
      if (value === '') jar.delete(name)
      else jar.set(name, value)
    }
  },
})

const { error: otpError } = await browserClient.auth.signInWithOtp({
  email,
  options: { emailRedirectTo: callbackUrl.toString(), shouldCreateUser: true },
})
record('寄送 magic link', !otpError, otpError?.message)
record('PKCE code verifier 已存入 cookie', [...jar.keys()].some((k) => k.includes('code-verifier')))

// ── 4. 從真實信件取回連結（Mailpit）─────────────────────
/** 從信件內文抓出 Supabase 的 verify 連結。 */
async function fetchMagicLinkFor(target: string): Promise<string | null> {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    try {
      const listRes = await fetch(`${MAILPIT}/api/v1/messages?limit=50`)
      const list = (await listRes.json()) as {
        messages?: { ID: string; To?: { Address?: string }[] }[]
      }
      const msg = list.messages?.find((m) =>
        m.To?.some((t) => t.Address?.toLowerCase() === target),
      )
      if (msg) {
        const bodyRes = await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`)
        const body = (await bodyRes.json()) as { HTML?: string; Text?: string }
        const raw = `${body.HTML ?? ''}\n${body.Text ?? ''}`
        const match = raw.match(/https?:\/\/[^\s"'<>]*\/auth\/v1\/verify[^\s"'<>]*/)
        if (match) return match[0].replace(/&amp;/g, '&')
      }
    } catch {
      /* Mailpit 尚未就緒 */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  return null
}

const magicLink = await fetchMagicLinkFor(email)
record('登入信已寄達且含 verify 連結', Boolean(magicLink), magicLink ? 'Mailpit' : '15 秒內未收到')

// ── 5. 點擊連結 → 取得授權碼 ─────────────────────────────
const verifyRes = await fetch(magicLink!, { redirect: 'manual' })
const redirectTo = verifyRes.headers.get('location') ?? ''
const code = new URL(redirectTo, APP).searchParams.get('code')
record('magic link 驗證通過並取得授權碼', Boolean(code), code ? '' : redirectTo)

// ── 6. 走完 callback：佈建 space ─────────────────────────
// 帶上 cookie jar（含 code verifier），模擬瀏覽器點連結後的請求。
function cookieHeader(): string {
  const session = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
  return withGate(session || undefined)
}

{
  const cbUrl = new URL('/auth/callback', APP)
  cbUrl.searchParams.set('code', code!)
  cbUrl.searchParams.set('invite', invite.token)
  cbUrl.searchParams.set('next', '/home')

  const res = await fetch(cbUrl, {
    redirect: 'manual',
    headers: { cookie: cookieHeader() },
  })
  const location = res.headers.get('location') ?? ''
  const setCookies = res.headers.getSetCookie?.() ?? []

  // 把 callback 設下的 session cookie 收進 jar，供後續請求使用
  for (const c of setCookies) {
    const [pair] = c.split(';')
    const idx = pair?.indexOf('=') ?? -1
    if (pair && idx > 0) jar.set(pair.slice(0, idx), pair.slice(idx + 1))
  }

  record(
    'callback 導向 /home 並設下 session cookie',
    location.includes('/home') && setCookies.length > 0,
    location.includes('/home') ? `${setCookies.length} 個 cookie` : location,
  )
}

// ── 6b. 帶 session 存取受保護頁面 ────────────────────────
{
  const res = await fetch(`${APP}/home`, {
    redirect: 'manual',
    headers: { cookie: cookieHeader() },
  })
  record('已登入者可存取 /home（未被導回登入頁）', res.status === 200, `HTTP ${res.status}`)
}

// ── 6c. 未登入者存取 /home 會被導回登入頁 ────────────────
// 帶閘門 cookie 但不帶 session：測的是「過了閘門、但未登入」→ 應導 /login。
{
  const res = await fetch(`${APP}/home`, { redirect: 'manual', headers: { cookie: GATE } })
  const loc = res.headers.get('location') ?? ''
  record('未登入者被導回 /login', loc.includes('/login'), loc || `HTTP ${res.status}`)
}

// ── 7. Space 與附屬資料都建立了 ──────────────────────────
const { data: users } = await db.auth.admin.listUsers({ page: 1, perPage: 200 })
const user = users?.users.find((u) => u.email?.toLowerCase() === email)
record('使用者已建立', Boolean(user))

const { data: membership } = await db
  .from('space_members')
  .select('space_id, role')
  .eq('user_id', user!.id)
  .maybeSingle()
record('space_members 有 owner 紀錄', membership?.role === 'owner')

const spaceId = membership!.space_id

for (const [table, label] of [
  ['spaces', 'space 本身'],
  ['space_settings', 'space_settings'],
  ['agent_profiles', 'agent_profiles'],
] as const) {
  const column = table === 'spaces' ? 'id' : 'space_id'
  const { data } = await db.from(table).select(column).eq(column, spaceId).maybeSingle()
  record(`${label} 已建立`, Boolean(data))
}

// ── 8. profiles 由 trigger 自動建立 ─────────────────────
{
  const { data } = await db.from('profiles').select('id').eq('id', user!.id).maybeSingle()
  record('profiles 由 trigger 自動建立', Boolean(data))
}

// ── 9. 隱私預設全部關閉（ADR-014）──────────────────────
{
  const { data } = await db
    .from('space_settings')
    .select('memory_enabled, ai_analysis_enabled, provider_data_enabled')
    .eq('space_id', spaceId)
    .single()

  const allOff =
    data?.memory_enabled === false &&
    data?.ai_analysis_enabled === false &&
    data?.provider_data_enabled === false
  record('隱私設定預設全部關閉（ADR-014）', allOff)
}

// ── 10. 邀請已標記使用，且不能重複使用 ───────────────────
{
  const { data } = await db
    .from('space_invites')
    .select('accepted_at, accepted_by')
    .eq('id', invite.inviteId)
    .single()
  record('邀請已標記為已使用', Boolean(data?.accepted_at) && data?.accepted_by === user!.id)
}

// ── 11. 事件與稽核都有寫入 ──────────────────────────────
{
  const { data: events } = await db
    .from('activity_events')
    .select('event_type')
    .eq('space_id', spaceId)
  record(
    'activity_events 記錄了 space.created',
    Boolean(events?.some((e) => e.event_type === 'space.created')),
    `${events?.length ?? 0} 筆事件`,
  )

  const { data: audits } = await db.from('audit_logs').select('action').eq('space_id', spaceId)
  record(
    'audit_logs 記錄了 invite.accepted',
    Boolean(audits?.some((a) => a.action === 'invite.accepted')),
  )
}

// ── 12. 二次登入：資料仍在（閉環的最後一哩）───────────────
{
  // 清空信箱，確保抓到的是這次寄出的信
  await fetch(`${MAILPIT}/api/v1/messages`, { method: 'DELETE' }).catch(() => {})

  // 登出：清空 cookie，等同使用者按下登出鈕
  await browserClient.auth.signOut()
  jar.clear()

  {
    const res = await fetch(`${APP}/home`, { redirect: 'manual', headers: { cookie: cookieHeader() } })
    const loc = res.headers.get('location') ?? ''
    record('登出後 /home 不再可存取', loc.includes('/login'), loc || `HTTP ${res.status}`)
  }

  // 全新的 client 與 cookie jar，如同重新打開瀏覽器
  const jar2 = new Map<string, string>()
  const secondClient = createUserClient({
    getAll: () => [...jar2.entries()].map(([name, value]) => ({ name, value })),
    setAll: (toSet) => {
      for (const { name, value } of toSet) {
        if (value === '') jar2.delete(name)
        else jar2.set(name, value)
      }
    },
  })

  // GoTrue 對同一個地址有重寄冷卻（預設 60 秒）。這是防濫用機制，
  // 不是 bug —— 但驗證腳本必須等過去，否則測到的是速率限制而非登入流程。
  let otp2Error: string | undefined
  for (let attempt = 0; attempt < 8; attempt++) {
    const { error } = await secondClient.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${APP}/auth/callback?next=/home` },
    })
    if (!error) {
      otp2Error = undefined
      break
    }
    otp2Error = error.message
    if (!/security purposes|rate|frequency|seconds/i.test(error.message)) break
    await new Promise((r) => setTimeout(r, 10_000))
  }

  const link2 = otp2Error ? null : await fetchMagicLinkFor(email)
  record('二次登入信已寄達', Boolean(link2), otp2Error)
  if (!link2) {
    console.error('  無法取得第二封信，中止後續步驟。')
    process.exit(1)
  }

  const vres = await fetch(link2, { redirect: 'manual' })
  const code2 = new URL(vres.headers.get('location') ?? '', APP).searchParams.get('code')

  const cookie2 = withGate([...jar2.entries()].map(([k, v]) => `${k}=${v}`).join('; ') || undefined)

  // 第二次沒有帶 invite —— 已經是成員了，應該直接放行
  const cb = await fetch(`${APP}/auth/callback?code=${code2}&next=/home`, {
    redirect: 'manual',
    headers: { cookie: cookie2 },
  })
  const loc = cb.headers.get('location') ?? ''
  record('二次登入（無邀請）仍可進入', loc.includes('/home'), loc)

  for (const c of cb.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(';')
    const idx = pair?.indexOf('=') ?? -1
    if (pair && idx > 0) jar2.set(pair.slice(0, idx), pair.slice(idx + 1))
  }

  {
    const res = await fetch(`${APP}/home`, {
      redirect: 'manual',
      headers: {
        cookie: withGate([...jar2.entries()].map(([k, v]) => `${k}=${v}`).join('; ') || undefined),
      },
    })
    record('重新登入後可存取 /home', res.status === 200, `HTTP ${res.status}`)
  }

  const { count } = await db
    .from('spaces')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', user!.id)
  record('二次登入沒有重複建立 space（資料仍在）', count === 1, `${count} 個 space`)
}

// ── 13. 清理 ────────────────────────────────────────────
await db.from('spaces').delete().eq('id', spaceId)
await db.auth.admin.deleteUser(user!.id)

// ── 結果 ────────────────────────────────────────────────
const failed = results.filter((r) => !r.ok)
console.log('')
console.log('─'.repeat(60))
console.log(`Milestone A 閉環：${results.length - failed.length}/${results.length} 通過`)
console.log('─'.repeat(60))

if (failed.length > 0) {
  console.error('\n失敗項目：')
  for (const f of failed) console.error(`  ✗ ${f.step}${f.detail ? ` — ${f.detail}` : ''}`)
  process.exit(1)
}
process.exit(0)
