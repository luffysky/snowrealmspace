import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { createAdminClient } from './server.js'

/**
 * LINE Login v2.1 的自建 OAuth 流程。實作 13-third-party-auth.md §2.1 路線 B。
 *
 * 為什麼自建而不用 Supabase：Supabase 沒有 LINE provider。
 * 代價是 state / nonce / id_token 簽章驗證都要自己做，
 * 這三項**沒有一項可以省略**：
 *   - 缺 state → CSRF，攻擊者能把自己的 LINE 綁到受害者帳號
 *   - 缺 nonce → id_token 重放
 *   - 缺簽章驗證 → 任何人都能偽造 id_token 冒充任意 LINE 使用者
 */

const AUTHORIZE_URL = 'https://access.line.me/oauth2/v2.1/authorize'
const TOKEN_URL = 'https://api.line.me/oauth2/v2.1/token'
const VERIFY_URL = 'https://api.line.me/oauth2/v2.1/verify'

export type LineIntent = 'link' | 'login'

export type LineConfig = {
  channelId: string
  channelSecret: string
  redirectUri: string
}

/** 讀取 LINE 設定。未設定時回 null —— 呼叫端據此把功能關掉，而不是崩潰。 */
export function lineConfig(): LineConfig | null {
  const channelId = process.env['LINE_LOGIN_CHANNEL_ID']
  const channelSecret = process.env['LINE_LOGIN_CHANNEL_SECRET']
  const redirectUri = process.env['LINE_LOGIN_REDIRECT_URI']
  if (!channelId || !channelSecret || !redirectUri) return null
  return { channelId, channelSecret, redirectUri }
}

export type StartResult = { authorizeUrl: string; state: string }

/**
 * 組出授權網址。抽成純函式是為了能單獨測 —— 這裡漏一個參數
 * （少了 nonce、scope 打錯）不會有任何執行期錯誤，
 * 只會在真的被攻擊時才發現。
 */
export function buildAuthorizeUrl(cfg: LineConfig, state: string, nonce: string): string {
  const url = new URL(AUTHORIZE_URL)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', cfg.channelId)
  url.searchParams.set('redirect_uri', cfg.redirectUri)
  url.searchParams.set('state', state)
  url.searchParams.set('nonce', nonce)
  // email 需要在 LINE Console 額外申請，且使用者可以拒絕。
  // 拿不到 email 時流程仍須能走完（§6）。
  url.searchParams.set('scope', 'openid profile email')
  return url.toString()
}

/**
 * id_token 的 claims → 我們的 profile。
 *
 * `emailVerified` 的判定刻意保守：LINE 只在 email 已驗證時才回傳
 * 這個 claim，所以「有 email」等同「已驗證」。
 * §5：未驗證的 email 絕不可用於自動合併帳號 —— 那是帳號接管漏洞。
 */
export function claimsToProfile(claims: {
  sub: string
  name?: string | undefined
  picture?: string | undefined
  email?: string | undefined
}): LineProfile {
  return {
    userId: claims.sub,
    displayName: claims.name ?? null,
    pictureUrl: claims.picture ?? null,
    email: claims.email ?? null,
    emailVerified: Boolean(claims.email),
  }
}

/** 固定時間比較。長度不同也不可提前回傳，否則長度會外洩。 */
export function constantTimeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

/**
 * 建立一筆 OAuth transaction 並回傳授權網址。
 *
 * state 與 nonce 存在資料庫而不是只存 cookie：
 * cookie 由使用者持有、可被竄改，DB 這一份才是權威來源，
 * 也才能保證「一個 state 只能用一次」。
 */
export async function startLineAuth(params: {
  intent: LineIntent
  userId?: string | undefined
  redirectTo?: string | undefined
}): Promise<StartResult> {
  const cfg = lineConfig()
  if (!cfg) throw new Error('LINE 登入未設定')

  const state = randomBytes(32).toString('base64url')
  const nonce = randomBytes(32).toString('base64url')

  const admin = createAdminClient()
  const { error } = await admin.from('oauth_transactions').insert({
    state,
    nonce,
    provider: 'line',
    intent: params.intent,
    user_id: params.userId ?? null,
    redirect_to: params.redirectTo ?? null,
  } as never)
  if (error) throw new Error(`建立 OAuth transaction 失敗：${error.message}`)

  return { authorizeUrl: buildAuthorizeUrl(cfg, state, nonce), state }
}

export type Transaction = {
  state: string
  nonce: string
  intent: LineIntent
  userId: string | null
  redirectTo: string | null
}

/**
 * 消耗一筆 transaction。**只能成功一次。**
 *
 * 用條件式 update 而非「先查再更新」來達成單次性：
 * `.is('consumed_at', null)` 讓資料庫負責原子性，
 * 併發的第二個請求會 update 到 0 列而拿到 null。
 */
export async function consumeTransaction(state: string): Promise<Transaction | null> {
  if (!state) return null
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('oauth_transactions')
    .update({ consumed_at: new Date().toISOString() } as never)
    .eq('state', state)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('state, nonce, intent, user_id, redirect_to')
    .maybeSingle()

  if (error || !data) return null
  const row = data as {
    state: string
    nonce: string
    intent: string
    user_id: string | null
    redirect_to: string | null
  }
  return {
    state: row.state,
    nonce: row.nonce,
    intent: row.intent as LineIntent,
    userId: row.user_id,
    redirectTo: row.redirect_to,
  }
}

export type LineProfile = {
  /** LINE userId（id_token 的 sub） */
  userId: string
  displayName: string | null
  pictureUrl: string | null
  email: string | null
  emailVerified: boolean
}

type TokenResponse = { id_token?: string; access_token?: string; error?: string }

/**
 * 用 code 換 token，並驗證 id_token。
 *
 * 簽章驗證委託給 LINE 的 `/oauth2/v2.1/verify` 端點而不是自己解 JWKS：
 * 少一份需要輪替的公鑰快取，而且 LINE 的 OIDC 實作有非標準之處
 * （§2.1 已註明），自己解容易在細節上出錯。
 * 這個端點會同時檢查簽章、aud、iss 與過期。
 */
export async function exchangeAndVerify(
  code: string,
  expectedNonce: string,
): Promise<{ ok: true; profile: LineProfile } | { ok: false; reason: string }> {
  const cfg = lineConfig()
  if (!cfg) return { ok: false, reason: 'not_configured' }

  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: cfg.redirectUri,
      client_id: cfg.channelId,
      client_secret: cfg.channelSecret,
    }),
  })

  const token = (await tokenRes.json()) as TokenResponse
  if (!tokenRes.ok || !token.id_token) {
    return { ok: false, reason: 'token_exchange_failed' }
  }

  const verifyRes = await fetch(VERIFY_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      id_token: token.id_token,
      client_id: cfg.channelId,
      nonce: expectedNonce,
    }),
  })

  if (!verifyRes.ok) return { ok: false, reason: 'id_token_invalid' }

  const claims = (await verifyRes.json()) as {
    sub?: string
    name?: string
    picture?: string
    email?: string
    nonce?: string
  }

  if (!claims.sub) return { ok: false, reason: 'id_token_invalid' }

  // verify 端點已比對過 nonce，這裡再比一次是縱深防禦：
  // 若 LINE 端行為改變（例如未帶 nonce 就放行），我們仍會擋下。
  if (!constantTimeEqual(claims.nonce ?? '', expectedNonce)) {
    return { ok: false, reason: 'nonce_mismatch' }
  }

  return {
    ok: true,
    profile: claimsToProfile({
      sub: claims.sub,
      name: claims.name,
      picture: claims.picture,
      email: claims.email,
    }),
  }
}

/** 清掉過期的 transaction。由 storage.gc 一併呼叫。 */
export async function pruneTransactions(): Promise<void> {
  const admin = createAdminClient()
  await admin.from('oauth_transactions').delete().lt('expires_at', new Date().toISOString())
}
