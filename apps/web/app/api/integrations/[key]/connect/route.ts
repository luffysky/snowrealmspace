import { randomBytes } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { getActiveSpace, getUser } from '@/lib/auth/session'
import { isEnabled } from '@/lib/flags'
import { ok, fail, handler } from '@/lib/api/respond'
import { sealTx } from '@/lib/integrations/canva'
import { PROVIDER_FLAG, buildAuthorize, isProviderKey, providerConfig } from '@/lib/integrations/providers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CONNECT_COOKIE = 'sr_provider_connect'
const TTL_MS = 10 * 60 * 1000

/**
 * 開始連接 design provider（04-api-contract.md §7）。
 *
 * 空間擁有者限定（§6.3）。flag 關閉的 provider 回 404（ADR-018）。
 * 生 state（+ Canva 的 PKCE verifier），把 { provider, spaceId, userId } 封進 httpOnly cookie，
 * 回傳 authorizeUrl。前端 window.location 過去；回呼時從 cookie 取回這次的暫存。
 */
export const POST = handler(async (_request: NextRequest, { params }: { params: Promise<{ key: string }> }) => {
  const { key } = await params
  if (!isProviderKey(key)) return fail('NOT_FOUND', '未知的 provider。')

  const user = await getUser()
  if (!user) return fail('UNAUTHENTICATED', '請先登入。')
  const active = await getActiveSpace()
  if (!active) return fail('FORBIDDEN', '找不到作用中的空間。')
  if (active.role !== 'owner') return fail('FORBIDDEN', '只有空間擁有者能連接外部設計工具。')

  // flag 關閉 → 404（不只隱藏按鈕）
  if (!(await isEnabled(PROVIDER_FLAG[key], active.space.id))) {
    return fail('NOT_FOUND', '這個整合尚未啟用。')
  }

  const cfg = providerConfig(key)
  if (!cfg) {
    return fail('UNPROCESSABLE', `尚未設定 ${key.toUpperCase()}_CLIENT_ID / _CLIENT_SECRET（請在部署環境變數設好後重啟）。`)
  }

  const state = randomBytes(16).toString('base64url')
  const { url, verifier } = buildAuthorize(cfg, state)

  const sealed = sealTx({
    provider: key,
    spaceId: active.space.id,
    userId: user.id,
    state,
    verifier,
    exp: Date.now() + TTL_MS,
  })
  if (!sealed) return fail('UNPROCESSABLE', '未設定 32-byte 加密金鑰（TOKEN_ENCRYPTION_SECRET），無法安全保存授權暫存。')

  const res = ok({ authorizeUrl: url })
  res.cookies.set(CONNECT_COOKIE, sealed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(TTL_MS / 1000),
  })
  return res
})
