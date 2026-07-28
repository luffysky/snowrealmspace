import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * 設計 provider 抽象（Milestone F）。見 docs/spec/10-acceptance.md「F — Integration」、v1.0 §20/§39。
 *
 * 目前提供：capability 宣告（前端只顯示實際支援的功能，禁永久 Coming Soon）、
 * webhook 簽章驗證與冪等 key。OAuth/sync 的實作需要 Figma app 憑證，屆時補上 adapter 方法。
 */

export type ProviderId = 'figma' | 'canva' | 'adobe' | 'adobe_express' | 'photoshop' | 'other'

/** ProviderCapabilities：宣告這個 provider 實際支援什麼。前端據此顯示，不做不支援的功能。 */
export type ProviderCapabilities = {
  provider: ProviderId
  displayName: string
  /** 是否已可連接（有 OAuth 實作 + 憑證）。false = 尚未開放，前端顯示「即將支援」但不給按鈕。 */
  connectable: boolean
  oauth: boolean
  webhooks: boolean
  fileSync: boolean
  versionHistory: boolean
  /** 支援選擇單一檔案同步（禁止預設同步整個 Team）。 */
  selectiveFiles: boolean
}

/** Figma 的能力宣告。connectable=false 直到 Luffy 設定 Figma app 憑證。 */
export const FIGMA_CAPABILITIES: ProviderCapabilities = {
  provider: 'figma',
  displayName: 'Figma',
  connectable: false, // 需要 FIGMA_CLIENT_ID/SECRET
  oauth: true,
  webhooks: true,
  fileSync: true,
  versionHistory: true,
  selectiveFiles: true,
}

/** Canva 的能力宣告（Canva Connect API：讀取＋分析設計）。connectable=false 直到設定 Canva app 憑證。 */
export const CANVA_CAPABILITIES: ProviderCapabilities = {
  provider: 'canva',
  displayName: 'Canva',
  connectable: false, // 需要 CANVA_CLIENT_ID/SECRET
  oauth: true,
  webhooks: false, // Canva Connect webhook 範圍待確認，先保守關閉
  fileSync: true,
  versionHistory: false,
  selectiveFiles: true,
}

/**
 * Adobe 的能力宣告（唯讀設計列舉＋分析）。connectable=false 直到設定 Adobe app 憑證。
 *
 * TODO(adobe): Adobe 的設計 API 與 Figma/Canva 都不同（Adobe IMS OAuth + Creative Cloud /
 * Adobe Express / Photoshop API 各有不同 scope、端點、資料形狀），且尚未取得憑證實測。
 * 這裡只做誠實的能力宣告與 adapter 佔位，不臆造可用的 sync。webhooks 先保守關閉（範圍待確認）。
 */
export const ADOBE_CAPABILITIES: ProviderCapabilities = {
  provider: 'adobe',
  displayName: 'Adobe',
  connectable: false, // 需要 ADOBE_CLIENT_ID/SECRET，且 OAuth/sync 待對 Adobe API 校正實測
  oauth: true,
  webhooks: false, // Adobe webhook 範圍待確認，先保守關閉
  fileSync: true,
  versionHistory: false,
  selectiveFiles: true,
}

export const ALL_PROVIDERS: ProviderCapabilities[] = [
  FIGMA_CAPABILITIES,
  CANVA_CAPABILITIES,
  ADOBE_CAPABILITIES,
]

export function capabilitiesFor(provider: ProviderId): ProviderCapabilities | undefined {
  return ALL_PROVIDERS.find((p) => p.provider === provider)
}

// ── 檔案列舉與抓取（Milestone F sync 半段 S1）──────────────
// 這些方法只做「拿 access token → 打 provider REST → 回正規化資料」，
// 不碰 DB / storage / env（那些是 app 層 orchestration 的責任）。位元組不在這裡落地。

/** 可供使用者選擇同步的檔案摘要。 */
export type ProviderFileSummary = {
  externalId: string
  title: string
  /** provider 端的預覽圖 URL（短期有效）。app 層負責下載位元組並存進 assets。 */
  thumbnailUrl: string | null
  updatedAt: string | null
}

/** listFiles 選項。container：Figma 需要 project id 才能列檔；Canva 用不到。 */
export type ProviderListOptions = { container?: string; cursor?: string }

export type ProviderListResult = { files: ProviderFileSummary[]; nextCursor: string | null }

/** 某版本的預覽來源。app 層據此下載位元組存入 assets（ADR-005）。 */
export type ProviderRendition = { url: string; mimeType: string | null }

/** fetchFile 的正規化輸出。sourceUrl 是「設計頁連結」而非檔案位元組 URL。 */
export type FetchedFile = {
  externalId: string
  title: string
  externalVersionId: string | null
  sourceUrl: string | null
  rendition: ProviderRendition | null
  metadata: Record<string, unknown>
}

/**
 * 連接當下「這是誰的帳號」的正規化識別（供多帳號並存用）。
 * externalId：provider 端穩定的帳號 id（存 design_connections.external_account_id，
 *   與 (space_id, provider) 一起做 unique → 同 provider 多帳號可並存）。
 * label：給使用者辨識用的顯示名（存 external_account_label），拿不到就 null。
 */
export type ProviderAccount = {
  externalId: string
  label: string | null
}

/**
 * provider REST 呼叫失敗（含 HTTP 狀態）。app 層據此給使用者看得到的錯誤，不吞掉。
 * retryAfterHeader 保留 provider 回的 Retry-After 原字串（429 時），解析交給上層（@snowrealm/design-sync 的 retry）。
 */
export class ProviderApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly retryAfterHeader: string | null = null,
  ) {
    super(message)
    this.name = 'ProviderApiError'
  }
}

/** 共用的 Bearer GET；非 2xx 一律拋 ProviderApiError（不靜默失敗）。 */
async function providerGetJson(url: string, accessToken: string): Promise<unknown> {
  let res: Response
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } })
  } catch (err) {
    throw new ProviderApiError(0, `連線失敗：${(err as Error).message}`)
  }
  const text = await res.text()
  if (!res.ok) {
    let msg = text
    try {
      const j = JSON.parse(text) as { message?: string; error?: string | { message?: string } }
      msg = j.message || (typeof j.error === 'string' ? j.error : j.error?.message) || text
    } catch {
      /* 非 JSON，原樣截斷 */
    }
    throw new ProviderApiError(res.status, String(msg).slice(0, 300), res.headers.get('retry-after'))
  }
  try {
    return JSON.parse(text)
  } catch {
    throw new ProviderApiError(res.status, 'provider 回應不是合法 JSON。')
  }
}

/**
 * DesignProviderAdapter 介面（v1.0 §20）。Figma 為第一個實作，Canva 同步跟上。
 */
export interface DesignProviderAdapter {
  readonly capabilities: ProviderCapabilities
  /** 驗證 webhook 簽章。 */
  verifyWebhook(rawBody: string, signature: string | null, secret: string): boolean
  /** 從 webhook payload 取得去重用的外部事件 id。 */
  externalEventId(payload: unknown): string | null
  /**
   * 從 webhook payload 取出「受影響的檔案外部 id」。
   * 注意：這是**檔案 id**，與 externalEventId（去重用的事件 id）是兩回事。無法判定則回空陣列。
   */
  affectedFileExternalIds(payload: unknown): string[]
  /** 列出使用者可選擇同步的檔案（禁預設同步整個 Team——列舉≠同步，同步由使用者明確挑選）。 */
  listFiles(accessToken: string, opts?: ProviderListOptions): Promise<ProviderListResult>
  /** 取單一檔案的中繼與預覽來源（位元組由 app 層下載後存 assets）。 */
  fetchFile(accessToken: string, externalId: string): Promise<FetchedFile>
  /**
   * 用剛換到的 access token 問 provider「這是誰的帳號」，回正規化 { externalId, label }。
   * 供 callback 以帳號為 key 存連線 → 同 provider 多帳號並存。
   * 非 2xx 一律拋 ProviderApiError（不靜默失敗；備援由 app 層決定，不在此吞掉）。
   */
  fetchAccount(accessToken: string): Promise<ProviderAccount>
}

/**
 * HMAC-SHA256 webhook 簽章驗證（timing-safe）。多數 provider 都用這個形式。
 * signature 可帶前綴（如 'sha256=...'），會自動剝除。
 */
export function verifyHmacSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false
  const sig = signature.includes('=') ? signature.split('=').pop()! : signature
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  const a = Buffer.from(sig, 'hex')
  const b = Buffer.from(expected, 'hex')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** provider_webhooks 的冪等 key：(provider, external_event_id)。unique 由 DB 保證。 */
export function webhookIdempotencyKey(provider: ProviderId, externalEventId: string): string {
  return `${provider}:${externalEventId}`
}

/**
 * Figma webhook 驗證 —— Figma 不簽章、不送 HMAC header，而是把「建立 webhook 時你自訂的
 * passcode」原樣回傳在每則事件的 body。驗證＝比對 payload.passcode 與你設定的 secret。
 * 見 https://www.figma.com/developers/api#webhooks-v2-endpoints（passcode 欄位）。
 *
 * 用 timing-safe 比較避免計時側信道。secret 未設定（空字串）時一律回 false（不驗＝不信）。
 */
export function verifyFigmaPasscode(payload: unknown, secret: string): boolean {
  if (!secret) return false
  const passcode = (payload as { passcode?: unknown })?.passcode
  if (typeof passcode !== 'string') return false
  const a = Buffer.from(passcode, 'utf8')
  const b = Buffer.from(secret, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** Figma adapter（capability + webhook；sync 待憑證）。 */
export class FigmaAdapter implements DesignProviderAdapter {
  readonly capabilities = FIGMA_CAPABILITIES

  verifyWebhook(rawBody: string, signature: string | null, secret: string): boolean {
    return verifyHmacSignature(rawBody, signature, secret)
  }

  externalEventId(payload: unknown): string | null {
    const p = payload as { event_id?: string; passcode?: string; timestamp?: string; file_key?: string }
    if (typeof p?.event_id === 'string') return p.event_id
    // Figma file_update 沒有 event_id → 用 file_key + timestamp 組
    if (p?.file_key && p?.timestamp) return `${p.file_key}:${p.timestamp}`
    return null
  }

  affectedFileExternalIds(payload: unknown): string[] {
    // Figma 事件把變動的檔案放在 file_key（見 webhooks v2）。
    const fileKey = (payload as { file_key?: unknown })?.file_key
    return typeof fileKey === 'string' && fileKey.length > 0 ? [fileKey] : []
  }

  // TODO(figma): 以下端點與 scope 仍待對最新 Figma OAuth/REST 文件確認，尚未實測。
  // Figma 2024 改版後 token/scope 有變動；啟用 Figma 前必須實測校正，勿當作已驗證。
  async listFiles(accessToken: string, opts?: ProviderListOptions): Promise<ProviderListResult> {
    // Figma 需要 project 脈絡才能列檔（GET /v1/projects/:project_id/files），
    // 沒有 container 時無法「列出全部」——這正好符合「禁預設同步整個 Team」。
    if (!opts?.container) {
      throw new ProviderApiError(400, 'Figma 需要指定 project id 才能列出檔案。')
    }
    const json = (await providerGetJson(
      `https://api.figma.com/v1/projects/${encodeURIComponent(opts.container)}/files`,
      accessToken,
    )) as { files?: Array<{ key?: string; name?: string; thumbnail_url?: string; last_modified?: string }> }
    const files = Array.isArray(json.files) ? json.files : []
    return {
      files: files
        .filter((f): f is { key: string } & typeof f => typeof f.key === 'string')
        .map((f) => ({
          externalId: f.key,
          title: f.name && f.name.length > 0 ? f.name : '(未命名檔案)',
          thumbnailUrl: f.thumbnail_url ?? null,
          updatedAt: f.last_modified ?? null,
        })),
      nextCursor: null,
    }
  }

  async fetchFile(accessToken: string, externalId: string): Promise<FetchedFile> {
    const json = (await providerGetJson(
      `https://api.figma.com/v1/files/${encodeURIComponent(externalId)}`,
      accessToken,
    )) as { name?: string; version?: string; thumbnailUrl?: string; lastModified?: string }
    return {
      externalId,
      title: json.name && json.name.length > 0 ? json.name : '(未命名檔案)',
      externalVersionId: json.version ?? null,
      sourceUrl: `https://www.figma.com/file/${encodeURIComponent(externalId)}`,
      rendition: json.thumbnailUrl ? { url: json.thumbnailUrl, mimeType: null } : null,
      metadata: { lastModified: json.lastModified ?? null },
    }
  }

  // Figma：GET /v1/me → { id, handle, email }（見 https://www.figma.com/developers/api#users-endpoints）。
  // externalId 用穩定的 id；label 優先 handle，其次 email。
  async fetchAccount(accessToken: string): Promise<ProviderAccount> {
    const json = (await providerGetJson('https://api.figma.com/v1/me', accessToken)) as {
      id?: string
      handle?: string
      email?: string
    }
    const externalId = typeof json.id === 'string' && json.id.length > 0 ? json.id : null
    if (!externalId) throw new ProviderApiError(502, 'Figma /v1/me 未回傳帳號 id。')
    const label = json.handle && json.handle.length > 0 ? json.handle : json.email && json.email.length > 0 ? json.email : null
    return { externalId, label }
  }
}

/** Canva adapter（capability + webhook 佔位；OAuth/sync 待 CANVA_CLIENT_ID/SECRET 才實作）。 */
export class CanvaAdapter implements DesignProviderAdapter {
  readonly capabilities = CANVA_CAPABILITIES

  verifyWebhook(rawBody: string, signature: string | null, secret: string): boolean {
    return verifyHmacSignature(rawBody, signature, secret)
  }

  externalEventId(payload: unknown): string | null {
    const p = payload as { event_id?: string; id?: string }
    if (typeof p?.event_id === 'string') return p.event_id
    if (typeof p?.id === 'string') return p.id
    return null
  }

  affectedFileExternalIds(payload: unknown): string[] {
    // TODO(canva): confirm webhook payload shape against Canva Connect docs (unverified).
    // 防禦性從幾種可能形狀取設計 id：design.id / data.design.id / id，取第一個非空字串。
    const p = payload as { design?: { id?: unknown }; data?: { design?: { id?: unknown } }; id?: unknown }
    const candidates = [p?.design?.id, p?.data?.design?.id, p?.id]
    for (const c of candidates) {
      if (typeof c === 'string' && c.length > 0) return [c]
    }
    return []
  }

  // Canva Connect REST v1（api.canva.com）。列設計、取單一設計；預覽用 design.thumbnail。
  // 註：高解析 export 需非同步 export job（建立→輪詢→取檔），屬後續（S2+），S1 先用 thumbnail 當預覽。
  async listFiles(accessToken: string, opts?: ProviderListOptions): Promise<ProviderListResult> {
    const params = new URLSearchParams({ limit: '50' })
    if (opts?.cursor) params.set('continuation', opts.cursor)
    const json = (await providerGetJson(
      `https://api.canva.com/rest/v1/designs?${params.toString()}`,
      accessToken,
    )) as { items?: CanvaDesign[]; continuation?: string }
    const items = Array.isArray(json.items) ? json.items : []
    return {
      files: items
        .filter((d): d is CanvaDesign & { id: string } => typeof d.id === 'string')
        .map((d) => ({
          externalId: d.id,
          title: d.title && d.title.length > 0 ? d.title : '(未命名設計)',
          thumbnailUrl: d.thumbnail?.url ?? null,
          updatedAt: canvaTimestampToIso(d.updated_at),
        })),
      nextCursor: typeof json.continuation === 'string' ? json.continuation : null,
    }
  }

  async fetchFile(accessToken: string, externalId: string): Promise<FetchedFile> {
    const json = (await providerGetJson(
      `https://api.canva.com/rest/v1/designs/${encodeURIComponent(externalId)}`,
      accessToken,
    )) as { design?: CanvaDesign } & CanvaDesign
    const d: CanvaDesign = json.design ?? json
    return {
      externalId: typeof d.id === 'string' ? d.id : externalId,
      title: d.title && d.title.length > 0 ? d.title : '(未命名設計)',
      // Canva 設計沒有明確 version id → 用 updated_at 當版本識別（同內容不會重複建版本）
      externalVersionId: d.updated_at != null ? String(d.updated_at) : null,
      sourceUrl: d.urls?.view_url ?? d.urls?.edit_url ?? null,
      rendition: d.thumbnail?.url ? { url: d.thumbnail.url, mimeType: null } : null,
      metadata: { thumbnail: d.thumbnail ?? null },
    }
  }

  // Canva Connect：GET /v1/users/me → { team_user: { user_id, team_id } }，
  // 顯示名另由 GET /v1/users/me/profile → { profile: { display_name } } 取（best-effort，失敗不致命）。
  // 見 https://www.canva.dev/docs/connect/api-reference/users/。
  // externalId 用 user_id（辨識不同 Canva 登入帳號）；拿不到才退回 team_id。
  async fetchAccount(accessToken: string): Promise<ProviderAccount> {
    const me = (await providerGetJson('https://api.canva.com/rest/v1/users/me', accessToken)) as {
      team_user?: { user_id?: string; team_id?: string }
    }
    const userId = me.team_user?.user_id
    const teamId = me.team_user?.team_id
    const externalId =
      typeof userId === 'string' && userId.length > 0
        ? userId
        : typeof teamId === 'string' && teamId.length > 0
          ? teamId
          : null
    if (!externalId) throw new ProviderApiError(502, 'Canva /v1/users/me 未回傳 user_id。')
    let label: string | null = null
    try {
      const prof = (await providerGetJson('https://api.canva.com/rest/v1/users/me/profile', accessToken)) as {
        profile?: { display_name?: string }
      }
      const name = prof.profile?.display_name
      label = typeof name === 'string' && name.length > 0 ? name : null
    } catch {
      // profile 端點失敗（scope 不足等）不影響帳號識別——label 留 null，仍以 user_id 存連線。
    }
    return { externalId, label }
  }
}

type CanvaDesign = {
  id?: string
  title?: string
  thumbnail?: { url?: string }
  urls?: { view_url?: string; edit_url?: string }
  updated_at?: number | string
}

/**
 * Adobe adapter（能力宣告佔位；OAuth/sync 待 ADOBE_CLIENT_ID/SECRET 且對 Adobe 實際 API 校正才實作）。
 *
 * TODO(adobe): Adobe 的授權（Adobe IMS）、scope、REST 端點與 webhook 形式都與 Figma/Canva 不同，
 * 且尚未取得憑證實測。在校正並實測前：
 * - listFiles/fetchFile 一律拋 ProviderApiError（不靜默、不假裝成功、不臆造 REST 呼叫）。
 * - webhook 驗證一律回 false（不驗＝不信），事件/檔案 id 解析為防禦性佔位。
 * 這是誠實的「尚未支援」骨架，而非假的可用流程。
 */
export class AdobeAdapter implements DesignProviderAdapter {
  readonly capabilities = ADOBE_CAPABILITIES

  verifyWebhook(_rawBody: string, _signature: string | null, _secret: string): boolean {
    // TODO(adobe): 確認 Adobe webhook 簽章形式（HMAC? JWS?）。校正前一律不信任。
    return false
  }

  externalEventId(payload: unknown): string | null {
    // TODO(adobe): confirm webhook payload shape (unverified). 防禦性從幾種可能形狀取事件 id。
    const p = payload as { event_id?: unknown; id?: unknown; xdmEventId?: unknown }
    for (const c of [p?.event_id, p?.id, p?.xdmEventId]) {
      if (typeof c === 'string' && c.length > 0) return c
    }
    return null
  }

  affectedFileExternalIds(payload: unknown): string[] {
    // TODO(adobe): confirm webhook payload shape (unverified). 防禦性從幾種可能形狀取資產 id。
    const p = payload as { asset?: { id?: unknown }; data?: { asset?: { id?: unknown } }; id?: unknown }
    for (const c of [p?.asset?.id, p?.data?.asset?.id, p?.id]) {
      if (typeof c === 'string' && c.length > 0) return [c]
    }
    return []
  }

  // TODO(adobe): Adobe 設計 API 端點/scope 與 Figma/Canva 不同，尚未取得憑證實測。
  // 在對 Adobe 官方文件校正並實測前，不臆造可用的 REST 呼叫——一律拋 ProviderApiError（不靜默、不假成功）。
  async listFiles(_accessToken: string, _opts?: ProviderListOptions): Promise<ProviderListResult> {
    throw new ProviderApiError(501, 'Adobe 檔案列舉尚未實作（TODO(adobe)：待對 Adobe API 校正並取得憑證實測）。')
  }

  async fetchFile(_accessToken: string, _externalId: string): Promise<FetchedFile> {
    throw new ProviderApiError(501, 'Adobe 檔案抓取尚未實作（TODO(adobe)：待對 Adobe API 校正並取得憑證實測）。')
  }

  // TODO(adobe): Adobe IMS 的「取得帳號 profile」端點（userinfo）與 scope 尚未校正實測。
  // 不臆造請求——拋 ProviderApiError。實務上 Adobe 的 exchangeCode 早已回 501、根本走不到這裡。
  async fetchAccount(_accessToken: string): Promise<ProviderAccount> {
    throw new ProviderApiError(501, 'Adobe 帳號識別尚未實作（TODO(adobe)：待對 Adobe IMS userinfo 校正並取得憑證實測）。')
  }
}

/** Canva 時間戳（多為 unix 秒）→ ISO；已是字串就原樣回傳。 */
function canvaTimestampToIso(ts: number | string | undefined): string | null {
  if (ts == null) return null
  if (typeof ts === 'number') return new Date(ts * 1000).toISOString()
  const asNum = Number(ts)
  if (Number.isFinite(asNum) && ts.trim() !== '') return new Date(asNum * 1000).toISOString()
  return ts
}
