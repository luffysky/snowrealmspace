import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'
import {
  CANVA_TX_COOKIE,
  type CanvaTokenResponse,
  type CanvaTx,
  canvaConfig,
  exchangeAuthCode,
  openTx,
  parseCanvaCallback,
  refreshCanvaToken,
} from '@/lib/integrations/canva'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 把 Canva 導回的網址換成 token（站台管理員限定）。
 *
 * exchange 模式：貼上回呼網址 → 取 code/state → 對照 cookie 裡的 PKCE verifier → 換 token。
 * refresh 模式：貼上 refresh_token → 換新的 access_token。
 *
 * token 只回傳給這個管理員畫面（同 secret reveal 的安全姿態），不自動落地——
 * Milestone F 的同步尚未實作，先誠實地把 token 交回，讓你貼進 secret 記事或 env。
 */

const schema = z.union([
  z
    .object({
      mode: z.literal('exchange').optional(),
      callbackUrl: z.string().trim().min(1, '請貼上 Canva 導回的網址').max(4000),
    })
    .strict(),
  z
    .object({
      mode: z.literal('refresh'),
      refreshToken: z.string().trim().min(1, '請貼上 refresh_token').max(4000),
    })
    .strict(),
])

function shapeTokens(t: CanvaTokenResponse) {
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token ?? null,
    tokenType: t.token_type,
    expiresInSec: t.expires_in,
    expiresAt: new Date(Date.now() + t.expires_in * 1000).toISOString(),
    scope: t.scope ?? null,
  }
}

export const POST = handler(async (request: NextRequest) => {
  const gate = await checkSiteAdmin()
  if (!gate.ok) return fail(gate.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '需要站台管理員身份。')

  const cfg = canvaConfig()
  if (!cfg) return fail('UNPROCESSABLE', '尚未設定 CANVA_CLIENT_ID / CANVA_CLIENT_SECRET。')

  const body: unknown = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)

  // ── refresh 模式 ──────────────────────────────────────
  if (parsed.data.mode === 'refresh') {
    const r = await refreshCanvaToken(cfg, parsed.data.refreshToken)
    if (!r.ok) return fail('PROVIDER_ERROR', `Canva 拒絕 refresh：${r.error}`)
    return ok(shapeTokens(r.tokens))
  }

  // ── exchange 模式 ─────────────────────────────────────
  const { code, state, error } = parseCanvaCallback(parsed.data.callbackUrl)
  if (error) return fail('UNPROCESSABLE', `Canva 授權被拒或取消：${error}`)
  if (!code) return fail('VALIDATION_FAILED', '貼上的網址裡找不到 code 參數。請確認貼的是 Canva 授權後導回的完整網址。')

  const sealed = request.cookies.get(CANVA_TX_COOKIE)?.value
  const tx = sealed ? openTx<CanvaTx>(sealed) : null
  if (!tx) {
    return fail(
      'UNPROCESSABLE',
      '找不到這次授權的 PKCE 暫存（可能逾時、或不是在同一個瀏覽器產生授權連結）。請重新產生授權連結後再試。',
    )
  }
  if (tx.exp < Date.now()) return fail('UNPROCESSABLE', '這次授權已逾時（超過 10 分鐘）。請重新產生授權連結。')
  if (state && tx.state && state !== tx.state) {
    return fail('FORBIDDEN', 'state 不相符（可能夾到了另一次的授權連結）。請重新產生授權連結。')
  }

  const r = await exchangeAuthCode(cfg, code, tx.verifier)
  if (!r.ok) return fail('PROVIDER_ERROR', `Canva 拒絕換取 token：${r.error}`)

  const res = ok(shapeTokens(r.tokens))
  res.cookies.delete(CANVA_TX_COOKIE) // 一次性，用完即清
  return res
})
