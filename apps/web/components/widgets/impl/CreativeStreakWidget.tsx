'use client'

import { useEffect, useState } from 'react'
import type { WidgetProps } from '../types'

/** 創作連續：讀 /api/streak（由 activity_events 算，不另存表）。唯讀。 */

type Data = { streak: number; activeToday: boolean; activeDays30: number }
type State = 'loading' | 'idle' | 'error'

export default function CreativeStreakWidget({ spaceId }: WidgetProps) {
  const [state, setState] = useState<State>('loading')
  const [data, setData] = useState<Data | null>(null)

  useEffect(() => {
    let alive = true
    setState('loading')
    fetch('/api/streak', { headers: { 'x-space-id': spaceId } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((b: { data: Data }) => {
        if (!alive) return
        setData(b.data)
        setState('idle')
      })
      .catch(() => {
        if (alive) setState('error')
      })
    return () => {
      alive = false
    }
  }, [spaceId])

  return (
    <div className="sr-card sr-widget" style={{ textAlign: 'center' }}>
      <h3 className="sr-widget-title">創作連續</h3>
      {state === 'error' ? (
        <p className="sr-muted" style={{ color: 'var(--sr-danger)', margin: 0 }}>讀不到活動紀錄。</p>
      ) : state === 'loading' ? (
        <p className="sr-muted" style={{ margin: 0 }}>計算中…</p>
      ) : data ? (
        <>
          <div style={{ fontSize: '2.2rem', margin: 'var(--sr-space-1) 0' }}>
            {data.streak > 0 ? '🔥' : '🌱'} {data.streak}
            <span style={{ fontSize: '1rem' }}> 天</span>
          </div>
          <p className="sr-muted" style={{ margin: 0 }}>
            {data.streak === 0
              ? '今天動一下，就開始了。'
              : data.activeToday
                ? '今天已經有動，保持住！'
                : '昨天有動；今天再來一下就接上了。'}
          </p>
          <p className="sr-muted" style={{ margin: '4px 0 0', fontSize: 'var(--sr-text-sm)' }}>
            近 30 天有 {data.activeDays30} 天在創作
          </p>
        </>
      ) : null}
    </div>
  )
}
