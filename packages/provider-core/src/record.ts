import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

/**
 * Milestone F sync S5 —— provider 回應「錄製」機制。
 *
 * 規格禁止手寫理想化的 provider mock（見 00-README §指示 6、docs/spec 10-acceptance F）。
 * 唯一合法的 mock 來源＝首次真憑證＋真檔的端到端實跑「錄下來」的真實回應。
 * 這支負責在實跑時把 adapter 打到的 provider REST 回應（已去敏）寫成 fixture 檔，
 * 供 replay mock（./replay.ts）在測試中重播。**只在 DESIGN_SYNC_RECORD_DIR 設定時才啟用**，
 * 平時完全不作動、不改變同步行為。
 *
 * fixture 依「provider + 端點類型」收斂成單一代表性檔案（recorded/<provider>/<endpoint>.json）：
 * 不以動態 id 逐檔展開，因為 replay 要能在不知道真實 id 的情況下重播（測試時 container/id 參數無關緊要）。
 */

export type FixtureEndpoint = 'list' | 'file' | 'account' | 'profile'
export type FixtureProvider = 'figma' | 'canva'
export type FixtureKey = { provider: FixtureProvider; endpoint: FixtureEndpoint }

/**
 * 從實際打出去的 provider REST URL 判定 (provider, 端點類型)。認不得的 URL 回 null
 * （既不錄也不重播——避免亂寫 fixture 或重播到不相干端點）。
 * 只認 sync 半段實際會用到的端點（listFiles / fetchFile / fetchAccount / profile）。
 */
export function fixtureKeyForUrl(url: string): FixtureKey | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  const path = u.pathname
  if (u.hostname === 'api.figma.com') {
    if (path === '/v1/me') return { provider: 'figma', endpoint: 'account' }
    if (/^\/v1\/projects\/[^/]+\/files\/?$/.test(path)) return { provider: 'figma', endpoint: 'list' }
    if (/^\/v1\/files\/[^/]+\/?$/.test(path)) return { provider: 'figma', endpoint: 'file' }
    return null
  }
  if (u.hostname === 'api.canva.com') {
    if (path === '/rest/v1/users/me/profile') return { provider: 'canva', endpoint: 'profile' }
    if (path === '/rest/v1/users/me') return { provider: 'canva', endpoint: 'account' }
    if (/^\/rest\/v1\/designs\/[^/]+\/?$/.test(path)) return { provider: 'canva', endpoint: 'file' }
    if (/^\/rest\/v1\/designs\/?$/.test(path)) return { provider: 'canva', endpoint: 'list' }
    return null
  }
  return null
}

/** fixture 檔的路徑：<dir>/<provider>/<endpoint>.json。record 與 replay 必須共用此推導以確保對齊。 */
export function fixturePathFor(dir: string, key: FixtureKey): string {
  return join(dir, key.provider, `${key.endpoint}.json`)
}

/**
 * 去敏 key 清單（小寫比對）。provider 回應可能夾帶 token、email、密鑰等——錄製前一律遮罩。
 * 這是「盡力而為」的第一道防線；提交 fixture 前仍必須人眼複查（見 __fixtures__/README.md）。
 */
const REDACT_KEYS = new Set([
  'access_token',
  'refresh_token',
  'token',
  'id_token',
  'authorization',
  'passcode',
  'secret',
  'client_secret',
  'password',
  'api_key',
  'apikey',
  'email',
  'phone',
  'phone_number',
])

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** 字串層級去敏：email → 遮罩；帶 query 的 URL（常含簽章 token）→ 去掉 query 只留路徑。 */
function redactString(s: string): string {
  if (EMAIL_RE.test(s)) return '[REDACTED_EMAIL]'
  if (/^https?:\/\//i.test(s)) {
    const q = s.indexOf('?')
    if (q >= 0) return `${s.slice(0, q)}?[REDACTED]`
  }
  return s
}

/**
 * 遞迴去敏一個 JSON 值。命中 REDACT_KEYS 的欄位整個換成 '[REDACTED]'；
 * 其餘字串跑 redactString（email / 帶簽章的 URL）。不改動結構，方便 replay 保留形狀。
 */
export function redactRecorded(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactRecorded)
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = REDACT_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : redactRecorded(v)
    }
    return out
  }
  if (typeof value === 'string') return redactString(value)
  return value
}

/**
 * 把一次 provider 回應寫成去敏後的 fixture。認不得的端點（fixtureKeyForUrl 回 null）直接略過。
 * 只在錄製流程（resolveDefaultHttpGet 偵測到 DESIGN_SYNC_RECORD_DIR）中被呼叫。
 */
export async function recordResponse(dir: string, url: string, body: unknown): Promise<void> {
  const key = fixtureKeyForUrl(url)
  if (!key) return
  const file = fixturePathFor(dir, key)
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, `${JSON.stringify(redactRecorded(body), null, 2)}\n`, 'utf8')
}
