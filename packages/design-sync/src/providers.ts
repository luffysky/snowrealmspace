import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import type { FeatureFlagKey } from '@snowrealm/shared-types'
import { appUrl } from './app-url'
import {
  CANVA_SCOPES,
  buildAuthorizeUrl as buildCanvaAuthorizeUrl,
  canvaConfig,
  exchangeAuthCode as exchangeCanvaCode,
  generatePkce,
  refreshCanvaToken,
  type CanvaTokenResponse,
} from './canva'

/**
 * Milestone F — 統一的 design provider OAuth（Figma + Canva）。
 *
 * 只在 server 端使用（讀 *_CLIENT_SECRET）。連接是 space owner 限定（02-domain-model.md §6.3）。
 * token 一律 AES-256-GCM 加密後存 design_connections，永不回傳前端（10-acceptance F）。
 *
 * Canva：PKCE + Basic auth（沿用 ./canva.ts 已驗證的實作）。
 * Figma：傳統 code flow（無 PKCE）。
 *   注意：Figma 2024 起改用 api.figma.com/v1/oauth/token + HTTP Basic。
 *   啟用 Figma 前請對照最新 Figma OAuth 文件確認端點與 scope（此處採目前公開文件值）。
 */

export type ProviderKey = 'figma' | 'canva' | 'adobe'

export const CONNECTABLE_PROVIDERS: ProviderKey[] = ['figma', 'canva', 'adobe']

/** 各 provider 對應的 feature flag（ADR-018：flag 關 → 端點 404、不出現在清單）。 */
export const PROVIDER_FLAG: Record<ProviderKey, FeatureFlagKey> = {
  figma: 'figmaIntegration',
  canva: 'canvaConnect',
  adobe: 'adobeExpress',
}

export const PROVIDER_LABEL: Record<ProviderKey, string> = { figma: 'Figma', canva: 'Canva', adobe: 'Adobe' }

export function isProviderKey(v: string): v is ProviderKey {
  return v === 'figma' || v === 'canva' || v === 'adobe'
}

// ── Figma OAuth 常數 ──────────────────────────────────────
const FIGMA_AUTHORIZE_URL = 'https://www.figma.com/oauth'
const FIGMA_TOKEN_URL = 'https://api.figma.com/v1/oauth/token'
/**
 * Figma scope 預設值。**純常數，供測試與 fallback 用**，不讀 env。
 * 執行期實際使用的 scope 由 figmaScopes() 決定（可用 env FIGMA_SCOPES 覆寫），
 * 讓維運者能對齊 Figma app 後台實際勾選的權限，不必改碼（避免「Invalid scopes for app」）。
 */
export const FIGMA_SCOPES = ['files:read'] as const

/**
 * 執行期 Figma scope：優先讀 env `FIGMA_SCOPES`（空白或逗號分隔），否則回預設 FIGMA_SCOPES。
 * 例：`FIGMA_SCOPES="files:read file_comments:read"` 或 `FIGMA_SCOPES=files:read,file_dev_resources:read`。
 */
export function figmaScopes(): readonly string[] {
  const raw = process.env.FIGMA_SCOPES?.trim()
  if (!raw) return FIGMA_SCOPES
  const parsed = raw.split(/[\s,]+/).filter(Boolean)
  return parsed.length > 0 ? parsed : FIGMA_SCOPES
}

// ── Adobe OAuth 常數（TODO(adobe)：Adobe IMS 授權/換 token 端點與 scope 與 Figma/Canva 都不同，
// 尚未取得憑證實測。啟用前必須對 Adobe IMS / Creative Cloud API 文件校正，勿當作已驗證。）──
// 授權與換 token 的實作在 buildAuthorize / exchangeCode / refreshToken 的 adobe 分支，
// 目前一律回明確的「尚未實作」錯誤，不臆造請求。
/** Adobe scope 預設值（純常數）。執行期可用 env `ADOBE_SCOPES` 覆寫。TODO(adobe): 待校正實際唯讀設計 scope。 */
export const ADOBE_SCOPES = ['openid'] as const

/** 執行期 Adobe scope：優先讀 env `ADOBE_SCOPES`，否則回預設。TODO(adobe): 校正實際 scope。 */
export function adobeScopes(): readonly string[] {
  const raw = process.env.ADOBE_SCOPES?.trim()
  if (!raw) return ADOBE_SCOPES
  const parsed = raw.split(/[\s,]+/).filter(Boolean)
  return parsed.length > 0 ? parsed : ADOBE_SCOPES
}

export type ProviderConfig = {
  provider: ProviderKey
  clientId: string
  clientSecret: string
  redirectUri: string
  scopes: readonly string[]
  usesPkce: boolean
}

export function redirectUriFor(provider: ProviderKey): string {
  const explicit =
    provider === 'canva'
      ? process.env.CANVA_REDIRECT_URI?.trim()
      : provider === 'adobe'
        ? process.env.ADOBE_REDIRECT_URI?.trim()
        : process.env.FIGMA_REDIRECT_URI?.trim()
  return explicit && explicit.length > 0 ? explicit : `${appUrl()}/api/integrations/${provider}/callback`
}

/** 有 client id/secret 才回傳設定；否則 null（connectable=false，不擺假按鈕）。 */
export function providerConfig(provider: ProviderKey): ProviderConfig | null {
  if (provider === 'canva') {
    const cfg = canvaConfig()
    if (!cfg) return null
    return {
      provider,
      clientId: cfg.clientId,
      clientSecret: cfg.clientSecret,
      redirectUri: cfg.redirectUri,
      scopes: CANVA_SCOPES,
      usesPkce: true,
    }
  }
  if (provider === 'adobe') {
    // TODO(adobe): 憑證閘門與 Figma 相同（未設 → null → connectable=false → 顯示「尚未設定」）。
    // 注意：即使設了憑證，OAuth 流程（buildAuthorize/exchangeCode）仍是 TODO(adobe)、尚未實測，
    // 會回明確的「尚未實作」錯誤而非假裝成功——啟用前必須先對 Adobe IMS 校正端點與 scope。
    const clientId = process.env.ADOBE_CLIENT_ID?.trim()
    const clientSecret = process.env.ADOBE_CLIENT_SECRET?.trim()
    if (!clientId || !clientSecret) return null
    return {
      provider,
      clientId,
      clientSecret,
      redirectUri: redirectUriFor('adobe'),
      scopes: adobeScopes(),
      usesPkce: true, // TODO(adobe): 確認 Adobe IMS 是否要求 PKCE
    }
  }
  const clientId = process.env.FIGMA_CLIENT_ID?.trim()
  const clientSecret = process.env.FIGMA_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) return null
  return {
    provider,
    clientId,
    clientSecret,
    redirectUri: redirectUriFor('figma'),
    scopes: figmaScopes(),
    usesPkce: false,
  }
}

export function isConnectable(provider: ProviderKey): boolean {
  return providerConfig(provider) !== null
}

// ── 授權 URL ──────────────────────────────────────────────
export type AuthorizeInit = { url: string; verifier: string | null }

export function buildAuthorize(cfg: ProviderConfig, state: string): AuthorizeInit {
  if (cfg.provider === 'adobe') {
    // TODO(adobe): Adobe IMS 授權 URL / PKCE / scope 尚未校正實測。不臆造授權請求——
    // 明確拋錯，避免產生一顆「看起來能連、按下去卻壞」的假按鈕。啟用前先實作此分支。
    throw new Error('Adobe 連接尚未實作（TODO(adobe)：待對 Adobe IMS OAuth 校正端點/scope 並實測）。')
  }
  if (cfg.provider === 'canva') {
    const { verifier, challenge } = generatePkce()
    const url = buildCanvaAuthorizeUrl({
      clientId: cfg.clientId,
      redirectUri: cfg.redirectUri,
      challenge,
      state,
      scopes: cfg.scopes,
    })
    return { url, verifier }
  }
  // Figma：無 PKCE
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    scope: cfg.scopes.join(' '),
    state,
    response_type: 'code',
  })
  return { url: `${FIGMA_AUTHORIZE_URL}?${params.toString()}`, verifier: null }
}

// ── 換 / 更新 token（正規化輸出）─────────────────────────
export type NormalizedTokens = {
  accessToken: string
  refreshToken: string | null
  expiresInSec: number
  scope: string | null
}

export type ProviderExchangeResult =
  | { ok: true; tokens: NormalizedTokens }
  | { ok: false; status: number; error: string }

function normalizeCanva(t: CanvaTokenResponse): NormalizedTokens {
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token ?? null,
    expiresInSec: t.expires_in,
    scope: t.scope ?? null,
  }
}

type FigmaTokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope?: string
}

async function figmaTokenRequest(cfg: ProviderConfig, body: URLSearchParams): Promise<ProviderExchangeResult> {
  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64')
  let res: Response
  try {
    res = await fetch(FIGMA_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    })
  } catch (err) {
    return { ok: false, status: 0, error: `連不上 Figma token 端點：${(err as Error).message}` }
  }
  const text = await res.text()
  if (!res.ok) {
    let msg = text
    try {
      const j = JSON.parse(text) as { error?: string; message?: string }
      msg = j.message || j.error || text
    } catch {
      /* 非 JSON */
    }
    return { ok: false, status: res.status, error: String(msg).slice(0, 500) }
  }
  try {
    const t = JSON.parse(text) as FigmaTokenResponse
    return {
      ok: true,
      tokens: {
        accessToken: t.access_token,
        refreshToken: t.refresh_token ?? null,
        expiresInSec: t.expires_in,
        scope: t.scope ?? null,
      },
    }
  } catch {
    return { ok: false, status: res.status, error: 'Figma 回應不是合法 JSON。' }
  }
}

export async function exchangeCode(
  cfg: ProviderConfig,
  code: string,
  verifier: string | null,
): Promise<ProviderExchangeResult> {
  if (cfg.provider === 'adobe') {
    // TODO(adobe): Adobe IMS token 端點/參數尚未校正實測。不臆造換 token 請求——回明確錯誤。
    return { ok: false, status: 501, error: 'Adobe 換 token 尚未實作（TODO(adobe)：待對 Adobe IMS 校正並實測）。' }
  }
  if (cfg.provider === 'canva') {
    const r = await exchangeCanvaCode(
      { clientId: cfg.clientId, clientSecret: cfg.clientSecret, redirectUri: cfg.redirectUri },
      code,
      verifier ?? '',
    )
    return r.ok ? { ok: true, tokens: normalizeCanva(r.tokens) } : r
  }
  return figmaTokenRequest(
    cfg,
    new URLSearchParams({ redirect_uri: cfg.redirectUri, code, grant_type: 'authorization_code' }),
  )
}

export async function refreshToken(cfg: ProviderConfig, refresh: string): Promise<ProviderExchangeResult> {
  if (cfg.provider === 'adobe') {
    // TODO(adobe): Adobe IMS refresh 尚未校正實測。不臆造請求——回明確錯誤。
    return { ok: false, status: 501, error: 'Adobe token 更新尚未實作（TODO(adobe)：待對 Adobe IMS 校正並實測）。' }
  }
  if (cfg.provider === 'canva') {
    const r = await refreshCanvaToken(
      { clientId: cfg.clientId, clientSecret: cfg.clientSecret, redirectUri: cfg.redirectUri },
      refresh,
    )
    return r.ok ? { ok: true, tokens: normalizeCanva(r.tokens) } : r
  }
  return figmaTokenRequest(cfg, new URLSearchParams({ refresh_token: refresh, grant_type: 'refresh_token' }))
}

// ── token 加密（存入 design_connections 前）──────────────────
const IV_BYTES = 12

function tokenKey(): Buffer | null {
  const b64 = process.env.TOKEN_ENCRYPTION_SECRET || process.env.AI_KEY_ENCRYPTION_SECRET
  if (!b64) return null
  const key = Buffer.from(b64, 'base64')
  return key.length === 32 ? key : null
}

/** 加密 token；未設金鑰時回 null（呼叫端據此拒絕儲存，而非存明碼）。 */
export function encryptToken(plaintext: string): string | null {
  const key = tokenKey()
  if (!key) return null
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`
}

export function decryptToken(encrypted: string): string | null {
  const key = tokenKey()
  if (!key) return null
  const [ivB64, tagB64, ctB64] = encrypted.split(':')
  if (!ivB64 || !tagB64 || !ctB64) return null
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'))
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
    return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}
