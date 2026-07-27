import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { appUrl } from './app-url'

/**
 * Canva Connect OAuth（PKCE + confidential client）。
 *
 * 只在 server 端使用（讀 CANVA_CLIENT_SECRET）。授權走 www.canva.com，
 * 換 token 走 api.canva.com。目前 scope 全為 :read（讀取＋分析設計），
 * 要寫入再擴充 CANVA_SCOPES 並在 Canva app 後台加對應權限。
 *
 * 見 docs/spec/10-acceptance.md「F — Integration」、packages/provider-core（能力宣告）。
 */

export const CANVA_AUTHORIZE_URL = 'https://www.canva.com/api/oauth/authorize'
export const CANVA_TOKEN_URL = 'https://api.canva.com/rest/v1/oauth/token'

/** 純讀取 scope。順序不影響 Canva；要與 app 後台勾選的權限一致。 */
export const CANVA_SCOPES = [
  'app:read',
  'asset:read',
  'brandtemplate:content:read',
  'brandtemplate:meta:read',
  'comment:read',
  'design:content:read',
  'design:meta:read',
  'design:permission:read',
  'folder:permission:read',
  'folder:read',
  'profile:read',
] as const

export function canvaRedirectUri(): string {
  const explicit = process.env.CANVA_REDIRECT_URI?.trim()
  return explicit && explicit.length > 0 ? explicit : `${appUrl()}/api/integrations/canva/callback`
}

export type CanvaConfig = { clientId: string; clientSecret: string; redirectUri: string }

/** 有設定 client id/secret 才回傳設定；否則 null（前端據此停用轉換器，不擺假按鈕）。 */
export function canvaConfig(): CanvaConfig | null {
  const clientId = process.env.CANVA_CLIENT_ID?.trim()
  const clientSecret = process.env.CANVA_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret, redirectUri: canvaRedirectUri() }
}

/** PKCE：verifier 隨機、challenge = base64url(sha256(verifier))。 */
export function generatePkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(48).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

export function buildAuthorizeUrl(opts: {
  clientId: string
  redirectUri: string
  challenge: string
  state: string
  scopes?: readonly string[]
}): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    scope: (opts.scopes ?? CANVA_SCOPES).join(' '),
    code_challenge: opts.challenge,
    code_challenge_method: 'S256',
    state: opts.state,
  })
  return `${CANVA_AUTHORIZE_URL}?${params.toString()}`
}

export type CanvaTokenResponse = {
  access_token: string
  refresh_token?: string
  token_type: string
  expires_in: number
  scope?: string
}

export type CanvaExchangeResult =
  | { ok: true; tokens: CanvaTokenResponse }
  | { ok: false; status: number; error: string }

/** confidential client：用 HTTP Basic 帶 client_id:client_secret。 */
async function postToken(cfg: CanvaConfig, body: URLSearchParams): Promise<CanvaExchangeResult> {
  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64')
  let res: Response
  try {
    res = await fetch(CANVA_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    })
  } catch (err) {
    return { ok: false, status: 0, error: `連不上 Canva token 端點：${(err as Error).message}` }
  }
  const text = await res.text()
  if (!res.ok) {
    let msg = text
    try {
      const j = JSON.parse(text) as { error?: string; error_description?: string; message?: string }
      msg = j.error_description || j.message || j.error || text
    } catch {
      /* 非 JSON，原樣截斷 */
    }
    return { ok: false, status: res.status, error: String(msg).slice(0, 500) }
  }
  try {
    return { ok: true, tokens: JSON.parse(text) as CanvaTokenResponse }
  } catch {
    return { ok: false, status: res.status, error: 'Canva 回應不是合法 JSON。' }
  }
}

export function exchangeAuthCode(cfg: CanvaConfig, code: string, verifier: string): Promise<CanvaExchangeResult> {
  return postToken(
    cfg,
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: verifier,
      redirect_uri: cfg.redirectUri,
    }),
  )
}

export function refreshCanvaToken(cfg: CanvaConfig, refreshToken: string): Promise<CanvaExchangeResult> {
  return postToken(
    cfg,
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  )
}

// ── PKCE 暫存（封進 httpOnly cookie，AES-256-GCM）─────────────────
// verifier 是一次性密鑰，授權與換 token 分兩個請求，需在兩者間保存。
// 用 TOKEN_ENCRYPTION_SECRET 加密，避免 cookie 若進 log 也不外洩。

const IV_BYTES = 12

function boxKey(): Buffer | null {
  const b64 = process.env.TOKEN_ENCRYPTION_SECRET || process.env.AI_KEY_ENCRYPTION_SECRET
  if (!b64) return null
  const key = Buffer.from(b64, 'base64')
  return key.length === 32 ? key : null
}

/** 封裝小物件成不可竄改的字串；未設加密金鑰時回 null。 */
export function sealTx(obj: unknown): string | null {
  const key = boxKey()
  if (!key) return null
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${ct.toString('base64url')}`
}

export function openTx<T>(sealed: string): T | null {
  const key = boxKey()
  if (!key) return null
  const [iv, tag, ct] = sealed.split('.')
  if (!iv || !tag || !ct) return null
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'))
    decipher.setAuthTag(Buffer.from(tag, 'base64url'))
    const pt = Buffer.concat([decipher.update(Buffer.from(ct, 'base64url')), decipher.final()]).toString('utf8')
    return JSON.parse(pt) as T
  } catch {
    return null
  }
}

/** 從貼上的回呼網址（或純 query string）抽出 code / state / error。 */
export function parseCanvaCallback(input: string): { code?: string; state?: string; error?: string } {
  let qs = input.trim()
  const qi = qs.indexOf('?')
  if (qi >= 0) qs = qs.slice(qi + 1)
  const hi = qs.indexOf('#')
  if (hi >= 0) qs = qs.slice(0, hi)
  const p = new URLSearchParams(qs)
  const out: { code?: string; state?: string; error?: string } = {}
  const code = p.get('code')
  if (code) out.code = code
  const state = p.get('state')
  if (state) out.state = state
  const error = p.get('error_description') ?? p.get('error')
  if (error) out.error = error
  return out
}

export const CANVA_TX_COOKIE = 'canva_oauth_tx'
export const CANVA_TX_TTL_MS = 10 * 60 * 1000

export type CanvaTx = { verifier: string; state: string; exp: number }
