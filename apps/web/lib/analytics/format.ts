/**
 * 後台「上線資訊」顯示用的純格式化工具（zh-TW）。
 * 無副作用、可在 server 或 client 呼叫。
 */

/** 判定是否在線：最後上線在 withinMin 分鐘內。 */
export function isOnline(lastSeenIso: string | null | undefined, withinMin = 5): boolean {
  if (!lastSeenIso) return false
  const t = new Date(lastSeenIso).getTime()
  if (Number.isNaN(t)) return false
  return Date.now() - t <= withinMin * 60_000
}

/** 秒數 → 人類可讀（例：1 小時 5 分、23 分、45 秒）。 */
export function humanDuration(totalSec: number | null | undefined): string {
  const s = Math.max(0, Math.round(totalSec ?? 0))
  if (s < 60) return `${s} 秒`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} 分`
  const h = Math.floor(m / 60)
  const remM = m % 60
  if (h < 24) return remM ? `${h} 小時 ${remM} 分` : `${h} 小時`
  const d = Math.floor(h / 24)
  const remH = h % 24
  return remH ? `${d} 天 ${remH} 小時` : `${d} 天`
}

/** ISO 時間 → 相對現在（例：剛剛、5 分鐘前、2 小時前、3 天前）。 */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '—'
  const diffSec = Math.round((Date.now() - t) / 1000)
  if (diffSec < 0) return '剛剛'
  if (diffSec < 60) return '剛剛'
  const m = Math.floor(diffSec / 60)
  if (m < 60) return `${m} 分鐘前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小時前`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} 天前`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo} 個月前`
  return `${Math.floor(mo / 12)} 年前`
}

/** 把地區三段（國家 · 省州 · 城市）組成一行，缺的略過；全缺回 '—'。 */
export function formatRegion(
  country: string | null | undefined,
  region: string | null | undefined,
  city: string | null | undefined,
): string {
  const parts = [country, region, city].filter((p): p is string => Boolean(p && p.trim()))
  return parts.length ? parts.join(' · ') : '—'
}

/** 裝置三段（類型 · 瀏覽器 · 系統）組成一行；全缺回 '—'。 */
export function formatDevice(
  deviceType: string | null | undefined,
  browser: string | null | undefined,
  os: string | null | undefined,
): string {
  const parts = [deviceType, browser, os].filter((p): p is string => Boolean(p && p.trim()))
  return parts.length ? parts.join(' · ') : '—'
}
