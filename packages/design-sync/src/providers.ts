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

export type ProviderKey = 'figma' | 'canva'

export const CONNECTABLE_PROVIDERS: ProviderKey[] = ['figma', 'canva']

/** 各 provider 對應的 feature flag（ADR-018：flag 關 → 端點 404、不出現在清單）。 */
export const PROVIDER_FLAG: Record<ProviderKey, FeatureFlagKey> = {
  figma: 'figmaIntegration',
  canva: 'canvaConnect',
}

export const PROVIDER_LABEL: Record<ProviderKey, string> = { figma: 'Figma', canva: 'Canva' }

export function isProviderKey(v: string): v is ProviderKey {
  return v === 'figma' || v === 'canva'
}

// ── Figma OAuth 常數 ──────────────────────────────────────
const FIGMA_AUTHORIZE_URL = 'https://www.figma.com/oauth'
const FIGMA_TOKEN_URL = 'https://api.figma.com/v1/oauth/token'
export const FIGMA_SCOPES = ['files:read'] as const

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
    provider === 'canva' ? process.env.CANVA_REDIRECT_URI?.trim() : process.env.FIGMA_REDIRECT_URI?.trim()
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
  const clientId = process.env.FIGMA_CLIENT_ID?.trim()
  const clientSecret = process.env.FIGMA_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) return null
  return {
    provider,
    clientId,
    clientSecret,
    redirectUri: redirectUriFor('figma'),
    scopes: FIGMA_SCOPES,
    usesPkce: false,
  }
}

export function isConnectable(provider: ProviderKey): boolean {
  return providerConfig(provider) !== null
}

// ── 授權 URL ──────────────────────────────────────────────
export type AuthorizeInit = { url: string; verifier: string | null }

export function buildAuthorize(cfg: ProviderConfig, state: string): AuthorizeInit {
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
