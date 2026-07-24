import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * 設計 provider 抽象（Milestone F）。見 docs/spec/10-acceptance.md「F — Integration」、v1.0 §20/§39。
 *
 * 目前提供：capability 宣告（前端只顯示實際支援的功能，禁永久 Coming Soon）、
 * webhook 簽章驗證與冪等 key。OAuth/sync 的實作需要 Figma app 憑證，屆時補上 adapter 方法。
 */

export type ProviderId = 'figma' | 'canva' | 'adobe_express' | 'photoshop' | 'other'

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

export const ALL_PROVIDERS: ProviderCapabilities[] = [FIGMA_CAPABILITIES]

export function capabilitiesFor(provider: ProviderId): ProviderCapabilities | undefined {
  return ALL_PROVIDERS.find((p) => p.provider === provider)
}

/**
 * DesignProviderAdapter 介面（v1.0 §20）。Figma 為第一個實作。
 * connect/sync 需要憑證，先以介面定義，實作在有憑證後補。
 */
export interface DesignProviderAdapter {
  readonly capabilities: ProviderCapabilities
  /** 驗證 webhook 簽章。 */
  verifyWebhook(rawBody: string, signature: string | null, secret: string): boolean
  /** 從 webhook payload 取得去重用的外部事件 id。 */
  externalEventId(payload: unknown): string | null
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
}
