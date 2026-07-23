/**
 * 背景輪播的排序與時間計算。
 *
 * 抽成純函式的理由：這裡的錯誤在真實環境幾乎不可能被清楚回報 ——
 * 「背景好像有時候沒換」沒有人會來報 bug，也無法重現。
 * 只能靠測試。
 */

export type PlayMode =
  | 'sequential'
  | 'random'
  | 'daily'
  | 'hourly'
  | 'per_login'
  | 'time_of_day'
  | 'day_of_week'
  | 'per_project'
  | 'manual'

/** 前端需要自己計時輪播的模式。其餘由伺服器端 resolver 決定。 */
export const CLIENT_ROTATED: readonly PlayMode[] = ['sequential', 'hourly', 'per_login']

export function needsClientRotation(mode: string): boolean {
  return (CLIENT_ROTATED as readonly string[]).includes(mode)
}

/**
 * 每次切換之間的毫秒數。
 *
 * `per_login` 回 null —— 它只在**開啟頁面時**決定一次，不會在停留期間換。
 * 讓它每 N 秒換是誤解了語意：使用者選它是為了「每次進來看到不一樣的」，
 * 不是為了看幻燈片。
 */
export function intervalMsFor(mode: string, intervalSeconds: number): number | null {
  if (mode === 'hourly') return 60 * 60 * 1000
  if (mode === 'sequential') {
    // 上限保護：設定值可能來自舊資料或手改的 API 請求。
    // 太短會讓瀏覽器一直在解碼圖片，太長等於沒有輪播。
    const seconds = Math.min(Math.max(intervalSeconds, 5), 24 * 60 * 60)
    return seconds * 1000
  }
  return null
}

/**
 * `per_login` 每次載入頁面選一張。
 *
 * 用 sessionStorage 的計數當種子而不是亂數：同一個分頁重新整理
 * 不該換背景（那看起來像 bug），但關掉再開就該換。
 */
export function perLoginIndex(loadCount: number, length: number): number {
  if (length <= 0) return 0
  return ((loadCount % length) + length) % length
}

/** 下一張的索引。到底了回到 0。 */
export function nextIndex(current: number, length: number): number {
  if (length <= 0) return 0
  return (current + 1) % length
}

export type Slot = { startHour: number; endHour: number; backgroundItemId: string }

/**
 * 時段排程的驗證。
 *
 * 允許跨午夜（22 → 6），那是「夜間」最自然的寫法。
 * 但**不允許重疊** —— 重疊時哪個生效取決於陣列順序，
 * 使用者無法從 UI 上看出來，等於是隨機行為。
 */
export function validateSlots(slots: readonly Slot[]): { ok: true } | { ok: false; message: string } {
  if (slots.length === 0) return { ok: true }

  for (const slot of slots) {
    if (!Number.isInteger(slot.startHour) || slot.startHour < 0 || slot.startHour > 23) {
      return { ok: false, message: '起始時間必須是 0–23 的整數' }
    }
    if (!Number.isInteger(slot.endHour) || slot.endHour < 0 || slot.endHour > 24) {
      return { ok: false, message: '結束時間必須是 0–24 的整數' }
    }
    if (slot.startHour === slot.endHour) {
      return { ok: false, message: '起始與結束時間不可相同' }
    }
  }

  // 展開成 24 個小時格再檢查重疊 —— 直接比對區間在跨午夜時很容易寫錯
  const occupied = new Array<number>(24).fill(-1)
  for (const [index, slot] of slots.entries()) {
    for (const hour of hoursIn(slot)) {
      if (occupied[hour] !== -1) {
        return {
          ok: false,
          message: `${String(hour).padStart(2, '0')}:00 同時屬於兩個時段，請調整`,
        }
      }
      occupied[hour] = index
    }
  }

  return { ok: true }
}

/** 一個時段涵蓋哪些小時。跨午夜時會繞回去。 */
export function hoursIn(slot: Slot): number[] {
  const end = slot.endHour === 24 ? 24 : slot.endHour
  const hours: number[] = []

  if (slot.startHour < end) {
    for (let h = slot.startHour; h < end; h++) hours.push(h % 24)
  } else {
    // 跨午夜：22 → 6 代表 22,23,0,1,2,3,4,5
    for (let h = slot.startHour; h < 24; h++) hours.push(h)
    for (let h = 0; h < end; h++) hours.push(h)
  }

  return hours
}

/** 沒有被任何時段涵蓋的小時。UI 要能明說「這些時間沒設定」。 */
export function uncoveredHours(slots: readonly Slot[]): number[] {
  const covered = new Set(slots.flatMap((s) => hoursIn(s)))
  return Array.from({ length: 24 }, (_, h) => h).filter((h) => !covered.has(h))
}
