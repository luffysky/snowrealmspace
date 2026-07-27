import { randomBytes } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { ok, fail, handler } from '@/lib/api/respond'
import {
  CANVA_SCOPES,
  CANVA_TX_COOKIE,
  CANVA_TX_TTL_MS,
  buildAuthorizeUrl,
  canvaConfig,
  generatePkce,
  sealTx,
} from '@/lib/integrations/canva'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 產生 Canva 授權連結（站台管理員限定）。
 *
 * 生 PKCE，把 verifier + state 封進 httpOnly cookie（換 token 那步要用），回傳 authorizeUrl。
 * cookie 10 分鐘後失效；同一個瀏覽器完成授權再回來貼網址即可。
 */
export const POST = handler(async (_request: NextRequest) => {
  const gate = await checkSiteAdmin()
  if (!gate.ok) return fail(gate.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '需要站台管理員身份。')

  const cfg = canvaConfig()
  if (!cfg) {
    return fail('UNPROCESSABLE', '尚未設定 CANVA_CLIENT_ID / CANVA_CLIENT_SECRET（請在 Zeabur web 環境變數設定後重啟）。')
  }

  const { verifier, challenge } = generatePkce()
  const state = randomBytes(16).toString('base64url')
  const sealed = sealTx({ verifier, state, exp: Date.now() + CANVA_TX_TTL_MS })
  if (!sealed) {
    return fail('UNPROCESSABLE', '未設定 32-byte 加密金鑰（TOKEN_ENCRYPTION_SECRET），無法安全保存 PKCE。')
  }

  const authorizeUrl = buildAuthorizeUrl({
    clientId: cfg.clientId,
    redirectUri: cfg.redirectUri,
    challenge,
    state,
  })

  const res = ok({
    authorizeUrl,
    redirectUri: cfg.redirectUri,
    scopes: CANVA_SCOPES,
    expiresInSec: Math.floor(CANVA_TX_TTL_MS / 1000),
  })
  res.cookies.set(CANVA_TX_COOKIE, sealed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(CANVA_TX_TTL_MS / 1000),
  })
  return res
})
