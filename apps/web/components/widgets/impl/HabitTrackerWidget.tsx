'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { WidgetProps } from '../types'

/**
 * 習慣追蹤：每天點一下今天的格子打卡，顯示目前連續天數與最近 35 天的格狀圖。
 *
 * 狀態（checkins：當地 YYYY-MM-DD 陣列）存回這個 widget 自己的 config，
 * 寫回時 **合併** 既有 config —— 保留 bg / bgAnimate / bgOpacity 等背景鍵。
 *
 * SSR/hydration：「今天是哪天」server 沒有穩定值，故 today 初始 null，
 * 只在 client 掛載後才算（見 DateTimeWidget 檔頭同理）；未掛載前只畫占位。
 */

type Cfg = { title?: string; checkins?: string[] }

const DAYS_SHOWN = 35
const MS_PER_DAY = 86_400_000

/** Date → 當地 'YYYY-MM-DD'（不經 UTC，避免跨時區差一天）。 */
function localDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 連續天數：從今天（或今天沒打卡則從昨天）往回數連續有打卡的天數。 */
function computeStreak(set: Set<string>, todayMs: number): number {
  let streak = 0
  let cursor = todayMs
  if (!set.has(localDateStr(new Date(cursor)))) {
    // 今天還沒打卡 —— 允許從昨天起算，不然一整天連續數字都是 0
    cursor -= MS_PER_DAY
    if (!set.has(localDateStr(new Date(cursor)))) return 0
  }
  while (set.has(localDateStr(new Date(cursor)))) {
    streak++
    cursor -= MS_PER_DAY
  }
  return streak
}

export default function HabitTrackerWidget({ spaceId, instanceId, config }: WidgetProps) {
  const cfg = (config as Cfg | null) ?? {}
  const title = cfg.title || '習慣'

  const [checkins, setCheckins] = useState<string[]>(() =>
    Array.isArray(cfg.checkins) ? cfg.checkins : [],
  )
  const [today, setToday] = useState<string | null>(null)
  const [todayMs, setTodayMs] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const now = new Date()
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    setToday(localDateStr(midnight))
    setTodayMs(midnight.getTime())
  }, [])

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const set = useMemo(() => new Set(checkins), [checkins])

  /** debounce 合併寫回：只換 checkins，保留背景等既有鍵。 */
  function persist(next: string[]) {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      void fetch(`/api/widgets/${instanceId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-space-id': spaceId },
        body: JSON.stringify({ config: { ...(config as object), checkins: next } }),
      })
        .then((r) => {
          if (!r.ok) throw new Error()
          setErr(null)
        })
        .catch(() => setErr('存不了，剛才的打卡可能沒同步。'))
    }, 500)
  }

  function toggleToday() {
    if (!today) return
    const next = set.has(today) ? checkins.filter((d) => d !== today) : [...checkins, today]
    setCheckins(next)
    persist(next)
  }

  // 掛載前占位：server / client 首幀一致。
  if (!today || todayMs === null) {
    return (
      <div className="sr-card sr-widget" style={{ minWidth: 0 }}>
        <h3 className="sr-widget-title" style={{ overflowWrap: 'anywhere' }}>
          {title}
        </h3>
        <p className="sr-muted" style={{ margin: 0 }}>
          載入中…
        </p>
      </div>
    )
  }

  const streak = computeStreak(set, todayMs)

  // 最近 DAYS_SHOWN 天，最舊在前、今天在最後。
  const cells: { date: string; checked: boolean; isToday: boolean }[] = []
  for (let i = DAYS_SHOWN - 1; i >= 0; i--) {
    const date = localDateStr(new Date(todayMs - i * MS_PER_DAY))
    cells.push({ date, checked: set.has(date), isToday: i === 0 })
  }

  return (
    <div className="sr-card sr-widget" style={{ minWidth: 0 }}>
      <h3 className="sr-widget-title" style={{ overflowWrap: 'anywhere' }}>
        {title}
      </h3>

      <p style={{ margin: 'var(--sr-space-1) 0 0', fontWeight: 600 }}>
        {streak > 0 ? `連續 ${streak} 天` : '今天還沒打卡'}
      </p>

      <div
        role="grid"
        aria-label="最近打卡"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '3px',
          marginTop: 'var(--sr-space-2)',
          minWidth: 0,
        }}
      >
        {cells.map((c) => (
          <span
            key={c.date}
            role="gridcell"
            title={c.date}
            aria-label={`${c.date}${c.checked ? '，已打卡' : ''}`}
            style={{
              aspectRatio: '1 / 1',
              borderRadius: 'var(--sr-radius-sm, 4px)',
              background: c.checked ? 'var(--sr-accent)' : 'var(--sr-surface-alt)',
              border: c.isToday ? '2px solid var(--sr-accent)' : '1px solid var(--sr-border)',
              boxSizing: 'border-box',
            }}
          />
        ))}
      </div>

      <button
        type="button"
        className={`sr-button ${set.has(today) ? 'sr-button-secondary' : ''}`}
        style={{ marginTop: 'var(--sr-space-2)' }}
        onClick={toggleToday}
        aria-pressed={set.has(today)}
      >
        {set.has(today) ? '取消今天打卡' : '今天打卡 ✓'}
      </button>

      {err && (
        <p className="sr-muted" style={{ color: 'var(--sr-danger)', margin: '4px 0 0', fontSize: 'var(--sr-text-sm)' }}>
          {err}
        </p>
      )}
    </div>
  )
}
