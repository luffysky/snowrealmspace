'use client'

import { useEffect, useState } from 'react'
import type { WidgetProps } from '../types'

/**
 * 時間日期：一個獨立小工具。即時走針的時鐘 + 可勾選的日期行
 * （西元年月日、星期、民國、農曆）。時間有幾種樣式可選。
 *
 * 全部日期換算走瀏覽器內建 Intl（民國 = roc 曆、農曆 = chinese 曆），
 * 不進網路、不取位置（permissions: []）。時間用裝置本地時區 = 使用者當地時間。
 *
 * SSR/hydration：時鐘的值每秒都在變，伺服器沒有穩定的「現在」——
 * 若在 server 就渲染時間，client 補水（hydrate）時值必然不同 → mismatch 警告。
 * 因此以 `now` 初始為 null，只在 client 掛載後的第一次 tick 才有值；
 * 在那之前只畫一個占位（標題 + 載入中…），server 與 client 首幀一致。
 *
 * 版面：時間放大（--sr-text-h1），日期行為 muted，緊湊；容器 min-width:0
 * 與 overflow-wrap:anywhere，確保任何寬度都不溢出格子（CLAUDE.md #5/#9）。
 * chrome 顏色一律用 --sr-* token。
 */

type TimeStyle =
  | '24 時（時:分）'
  | '24 時（時:分:秒）'
  | '12 時（上午/下午 時:分）'
  | '12 時（上午/下午 時:分:秒）'

type Cfg = {
  showTime?: boolean
  timeStyle?: TimeStyle
  showGregorian?: boolean
  showWeekday?: boolean
  showRoc?: boolean
  showLunar?: boolean
}

/** timeStyle → Intl 時間選項。12 時樣式帶 hour12，秒依樣式決定。 */
function timeOptions(style: TimeStyle): Intl.DateTimeFormatOptions {
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
function safeFormat(locale: string, options: Intl.DateTimeFormatOptions, date: Date): string | null {
  try {
    return new Intl.DateTimeFormat(locale, options).format(date)
  } catch {
    return null
  }
}

// 農曆日的傳統寫法（初一…三十）；Intl 的 chinese 曆只給阿拉伯數字，故自己對應。
const LUNAR_DAYS = [
  '',
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
]

/** 農曆「六月十六」：月份用 Intl（含閏月），日改成傳統寫法。缺 chinese 曆回 null。 */
function lunarText(date: Date): string | null {
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

export default function DateTimeWidget({ config }: WidgetProps) {
  const cfg = (config as Cfg | null) ?? {}
  const showTime = cfg.showTime ?? true
  const timeStyle: TimeStyle = cfg.timeStyle ?? '24 時（時:分）'
  const showGregorian = cfg.showGregorian ?? true
  const showWeekday = cfg.showWeekday ?? true
  const showRoc = cfg.showRoc ?? false
  const showLunar = cfg.showLunar ?? false

  // null 直到 client 首次 tick —— 避免 SSR/hydration mismatch（見檔頭）。
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // 掛載前的占位：server 與 client 首幀一致。
  if (!now) {
    return (
      <div className="sr-card sr-widget" style={{ minWidth: 0 }}>
        <h3 className="sr-widget-title">時間日期</h3>
        <p className="sr-muted" style={{ margin: 0 }}>
          載入中…
        </p>
      </div>
    )
  }

  // ── 時間 ──（裝置本地時區 = 當地時間）
  const timeText = showTime ? safeFormat('zh-TW', timeOptions(timeStyle), now) : null

  // ── 西元 + 星期 ──
  // 兩者都開 → 合成一行「2026年7月29日 星期三」；只開星期 → 只顯示「星期三」。
  let gregorianLine: string | null = null
  if (showGregorian) {
    gregorianLine = safeFormat(
      'zh-TW',
      {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        ...(showWeekday ? { weekday: 'long' } : {}),
      },
      now,
    )
  } else if (showWeekday) {
    gregorianLine = safeFormat('zh-TW', { weekday: 'long' }, now)
  }

  // ── 民國（roc 曆）──
  // Intl 一般已含「民國」紀元字樣（如「民國115年7月29日」）；保險起見，
  // 若輸出未含「民國」則自行補上前綴。
  let rocLine: string | null = null
  if (showRoc) {
    const raw = safeFormat('zh-TW-u-ca-roc', { year: 'numeric', month: 'long', day: 'numeric' }, now)
    if (raw) rocLine = raw.includes('民國') ? raw : `民國${raw}`
  }

  // ── 農曆（chinese 曆）──「農曆六月十六」（日用傳統寫法）。
  const lunarLine: string | null = showLunar ? lunarText(now) : null

  const dateLines = [gregorianLine, rocLine, lunarLine].filter((x): x is string => x !== null)

  return (
    <div className="sr-card sr-widget" style={{ minWidth: 0 }}>
      <h3 className="sr-widget-title">時間日期</h3>

      {timeText && (
        <div
          style={{
            fontSize: 'var(--sr-text-h1)',
            fontWeight: 700,
            lineHeight: 1.1,
            fontVariantNumeric: 'tabular-nums',
            minWidth: 0,
            overflowWrap: 'anywhere',
          }}
        >
          {timeText}
        </div>
      )}

      {dateLines.length > 0 && (
        <div
          className="sr-muted"
          style={{ marginTop: 'var(--sr-space-1)', minWidth: 0, overflowWrap: 'anywhere', lineHeight: 1.5 }}
        >
          {dateLines.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      )}

      {!timeText && dateLines.length === 0 && (
        <p className="sr-muted" style={{ margin: 0 }}>
          都沒有勾選要顯示的項目，到設定勾選時間或日期。
        </p>
      )}
    </div>
  )
}
