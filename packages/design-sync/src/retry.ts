/**
 * 純函式：同步重試/退避/429 判斷。無 I/O、可決定性，供 worker 決策並易於單元測試。
 * 見 docs/spec/10-acceptance.md「F — Integration」：指數退避、429 依 Retry-After、連 5 次失敗轉 error。
 */

/** 連續失敗達此上限即放棄（轉 error + 通知）。attempt 從 1 起算，第 5 次仍失敗即放棄。 */
export const MAX_SYNC_ATTEMPTS = 5

/**
 * 是否為「暫時性」錯誤（值得重試）：
 * - 0：網路層失敗（連不上）
 * - 429：被限流
 * - 5xx：provider 端暫時性
 * 其餘（4xx，如 401/403/404）視為永久性 —— 重試無用，直接放棄。
 */
export function isTransientStatus(status: number): boolean {
  return status === 0 || status === 429 || status >= 500
}

/**
 * 指數退避（毫秒）：base * 2^(attempt-1)，上限 cap。attempt 從 1 起算。
 * 預設 30s 起、上限 30 分鐘。
 */
export function backoffMs(attempt: number, baseMs = 30_000, capMs = 30 * 60_000): number {
  const a = Math.max(1, Math.floor(attempt))
  const raw = baseMs * 2 ** (a - 1)
  return Math.min(capMs, Math.max(0, raw))
}

/**
 * 解析 Retry-After header → 秒。支援「純秒數」與「HTTP-date」兩種格式；無法解析回 null。
 * now 可注入以利測試 HTTP-date 分支。
 */
export function parseRetryAfterSeconds(
  headerValue: string | null | undefined,
  now: number = Date.now(),
): number | null {
  if (headerValue == null) return null
  const s = headerValue.trim()
  if (s === '') return null
  if (/^\d+$/.test(s)) return Math.max(0, parseInt(s, 10))
  const dateMs = Date.parse(s)
  if (!Number.isNaN(dateMs)) return Math.max(0, Math.round((dateMs - now) / 1000))
  return null
}

/**
 * 下次重試延遲（毫秒）：優先採用 Retry-After（429 時 provider 明確指示），
 * 否則用指數退避。
 */
export function nextDelayMs(opts: {
  status: number
  attempt: number
  retryAfterSeconds?: number | null
}): number {
  if (opts.retryAfterSeconds != null && opts.retryAfterSeconds >= 0) {
    return opts.retryAfterSeconds * 1000
  }
  return backoffMs(opts.attempt)
}

/** 是否放棄重試：永久性錯誤，或已達最大嘗試次數。 */
export function shouldGiveUp(status: number, attempt: number, maxAttempts: number = MAX_SYNC_ATTEMPTS): boolean {
  if (!isTransientStatus(status)) return true
  return attempt >= maxAttempts
}
