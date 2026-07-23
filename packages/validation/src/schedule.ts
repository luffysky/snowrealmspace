import type { ScheduleSpec } from './backgrounds.js'

/**
 * 背景排程的時間計算。
 *
 * v1.0 §12.7：排程以 **space 時區** 計算，不是 UTC，也不是瀏覽器時區。
 * 使用者設定「17:00 換黃昏背景」指的是他所在時區的 17:00。
 *
 * 放在 package 而非 apps/web：這是領域邏輯，且必須能被單元測試 ——
 * 時區錯誤在正式環境幾乎不可能被使用者清楚回報。
 */

/** 某時區的當地小時（0–23）。 */
export function localHour(date: Date, timeZone: string): number {
  try {
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      hour12: false,
    }).format(date)
    const parsed = Number(formatted)
    return Number.isFinite(parsed) ? parsed % 24 : date.getUTCHours()
  } catch {
    // 無效時區字串：退回 UTC 而不是拋錯，背景不該讓整頁掛掉
    return date.getUTCHours()
  }
}

/** 某時區的當地日期（YYYY-MM-DD）。 */
export function localDate(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date)
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

/**
 * 找出當下時段對應的 slot。支援跨午夜（如 21:00–06:00）。
 *
 * 跨午夜是最容易寫錯的一段：`hour >= start && hour < end` 對
 * start=21 end=6 永遠為 false，夜晚背景就永遠不會出現。
 */
export function slotForHour(schedule: ScheduleSpec, hour: number) {
  for (const slot of schedule.slots) {
    const { startHour, endHour } = slot
    const crossesMidnight = endHour <= startHour
    const inRange = crossesMidnight
      ? hour >= startHour || hour < endHour
      : hour >= startHour && hour < endHour
    if (inRange) return slot
  }
  return null
}

/**
 * 確定性的偽隨機索引。
 *
 * `random` 與 `daily` 模式不用 Math.random()：
 * 同一天內重新整理應該看到同一張，否則每次載入都跳一張會讓人分心。
 * 以「清單 id + 當地日期」當種子。
 */
export function seededIndex(seed: string, length: number): number {
  if (length <= 0) return 0
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  }
  return Math.abs(hash) % length
}
