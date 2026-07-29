/**
 * 日期／時間格式化的共用邏輯。全部走瀏覽器內建 Intl（民國 = roc 曆、農曆 = chinese 曆），
 * 不進網路、不取位置。由 DateTimeWidget 與 WeatherDateTimeWidget 共用（同一套格式化，不重複）。
 *
 * 指針時鐘（SKINS / AnalogClock / ROMAN / polar）刻意留在 DateTimeWidget —— 只有它用。
 */

export type TimeStyle =
  | '24 時（時:分）'
  | '24 時（時:分:秒）'
  | '12 時（上午/下午 時:分）'
  | '12 時（上午/下午 時:分:秒）'

/** timeStyle → Intl 時間選項。12 時樣式帶 hour12，秒依樣式決定。 */
export function timeOptions(style: TimeStyle): Intl.DateTimeFormatOptions {
  const hour12 = style.startsWith('12 時')
  const withSeconds = style.includes('時:分:秒')
  return {
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' } : {}),
    hour12,
  }
}

/** 安全格式化：任一瀏覽器缺該曆別就回 null，讓那一行優雅略過（不崩）。 */
export function safeFormat(
  locale: string,
  options: Intl.DateTimeFormatOptions,
  date: Date,
): string | null {
  try {
    return new Intl.DateTimeFormat(locale, options).format(date)
  } catch {
    return null
  }
}

// 農曆日的傳統寫法（初一…三十）；Intl 的 chinese 曆只給阿拉伯數字，故自己對應。
export const LUNAR_DAYS = [
  '',
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
]

/** 農曆「六月十六」：月份用 Intl（含閏月），日改成傳統寫法。缺 chinese 曆回 null。 */
export function lunarText(date: Date): string | null {
  try {
    const parts = new Intl.DateTimeFormat('zh-TW-u-ca-chinese', {
      month: 'long',
      day: 'numeric',
    }).formatToParts(date)
    const month = parts.find((p) => p.type === 'month')?.value ?? ''
    const dayRaw = parts.find((p) => p.type === 'day')?.value ?? ''
    const dayNum = Number(dayRaw)
    const day = LUNAR_DAYS[dayNum] ?? dayRaw
    if (!month && !day) return null
    return `農曆${month}${day}`
  } catch {
    return null
  }
}

/**
 * 西元日期行「2026年7月29日（星期三）」。showWeekday 才帶星期。缺曆別回 null。
 * 注意：這是 showGregorian=true 的路徑；只想單獨顯示星期時，用 safeFormat 取 weekday。
 */
export function gregorianText(date: Date, showWeekday: boolean): string | null {
  return safeFormat(
    'zh-TW',
    {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      ...(showWeekday ? { weekday: 'long' } : {}),
    },
    date,
  )
}

/**
 * 民國（roc 曆）日期行「民國115年7月29日」。
 * Intl 一般已含「民國」紀元字樣；保險起見若輸出未含「民國」則自行補上前綴。缺曆別回 null。
 */
export function rocText(date: Date): string | null {
  const raw = safeFormat('zh-TW-u-ca-roc', { year: 'numeric', month: 'long', day: 'numeric' }, date)
  if (!raw) return null
  return raw.includes('民國') ? raw : `民國${raw}`
}
