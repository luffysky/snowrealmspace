'use client'

import { useEffect, useState } from 'react'
import type { WidgetProps } from '../types'

/**
 * 迷你月曆：顯示本月，今天以 --sr-accent 高亮。
 * 可選在下方顯示今天的農曆（Intl chinese 曆，缺曆別時優雅略過）。
 *
 * SSR/hydration：本月/今天是每天在變的值，server 沒有穩定的「現在」——
 * 故 today 初始 null，只在 client 掛載後才有值（見 DateTimeWidget 檔頭）。
 * chrome 顏色一律用 --sr-* token。
 */

type Cfg = { showLunar?: boolean }

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

const LUNAR_DAYS = [
  '',
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
]

/** 今天農曆「六月十六」；缺 chinese 曆回 null。 */
function lunarText(date: Date): string | null {
  try {
    const parts = new Intl.DateTimeFormat('zh-TW-u-ca-chinese', { month: 'long', day: 'numeric' }).formatToParts(date)
    const month = parts.find((p) => p.type === 'month')?.value ?? ''
    const dayRaw = parts.find((p) => p.type === 'day')?.value ?? ''
    const day = LUNAR_DAYS[Number(dayRaw)] ?? dayRaw
    if (!month && !day) return null
    return `農曆${month}${day}`
  } catch {
    return null
  }
}

export default function MiniCalendarWidget({ config }: WidgetProps) {
  const showLunar = (config as Cfg | null)?.showLunar ?? false

  const [today, setToday] = useState<Date | null>(null)
  useEffect(() => {
    setToday(new Date())
  }, [])

  if (!today) {
    return (
      <div className="sr-card sr-widget" style={{ minWidth: 0 }}>
        <h3 className="sr-widget-title">迷你月曆</h3>
        <p className="sr-muted" style={{ margin: 0 }}>
          載入中…
        </p>
      </div>
    )
  }

  const year = today.getFullYear()
  const month = today.getMonth() // 0-based
  const todayDate = today.getDate()
  const firstWeekday = new Date(year, month, 1).getDay() // 0=週日
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // 前導空白 + 各日；補到 7 的倍數不需要（grid 自動換行）。
  const cells: (number | null)[] = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const monthLabel = `${year} 年 ${month + 1} 月`
  const lunar = showLunar ? lunarText(today) : null

  return (
    <div className="sr-card sr-widget" style={{ minWidth: 0 }}>
      <h3 className="sr-widget-title">{monthLabel}</h3>

      <div
        role="grid"
        aria-label={monthLabel}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '2px',
          minWidth: 0,
          fontSize: 'clamp(0.7rem, 6cqi, 0.95rem)',
          textAlign: 'center',
        }}
      >
        {WEEKDAYS.map((w) => (
          <div key={w} className="sr-muted" style={{ fontWeight: 600, padding: '2px 0' }}>
            {w}
          </div>
        ))}
        {cells.map((d, i) => {
          const isToday = d === todayDate
          return (
            <div
              key={d === null ? `blank-${i}` : `d-${d}`}
              style={{
                padding: '3px 0',
                borderRadius: 'var(--sr-radius-sm)',
                fontVariantNumeric: 'tabular-nums',
                ...(isToday
                  ? { background: 'var(--sr-accent)', color: 'var(--sr-on-accent, #fff)', fontWeight: 700 }
                  : {}),
              }}
            >
              {d ?? ''}
            </div>
          )
        })}
      </div>

      {lunar && (
        <p className="sr-muted" style={{ margin: 'var(--sr-space-2) 0 0', overflowWrap: 'anywhere' }}>
          {lunar}
        </p>
      )}
    </div>
  )
}
