'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { WidgetProps } from '../types'

type Event = { id: string; event_type: string; title: string | null; occurred_at: string }

/** 時間軸預覽：最近或「在這一天」的事件。資料來自 /api/timeline。 */
export default function TimelinePreviewWidget({ spaceId, config }: WidgetProps) {
  const limit = (config as { limit?: number } | null)?.limit ?? 5
  const view = (config as { view?: string } | null)?.view === 'on_this_day' ? 'on_this_day' : 'recent'
  const [items, setItems] = useState<Event[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading')

  useEffect(() => {
    let alive = true
    fetch(`/api/timeline?view=${view}`, { headers: { 'x-space-id': spaceId } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((json: { data?: Event[] }) => {
        if (!alive) return
        const list = (json.data ?? []).slice(0, limit)
        setItems(list)
        setState(list.length ? 'ready' : 'empty')
      })
      .catch(() => alive && setState('error'))
    return () => {
      alive = false
    }
  }, [spaceId, limit, view])

  if (state === 'loading') return <div className="sr-card sr-widget" aria-busy="true"><span className="sr-muted">載入時間軸…</span></div>
  if (state === 'error') return <div className="sr-card sr-widget"><p className="sr-muted" style={{ margin: 0 }}>讀不到時間軸。</p></div>

  return (
    <div className="sr-card sr-widget">
      <h3 className="sr-widget-title">時間軸{view === 'on_this_day' ? '·在這一天' : ''}</h3>
      {state === 'empty' ? (
        <p className="sr-muted" style={{ margin: 0 }}>
          {view === 'on_this_day' ? '這一天還沒有故事。' : '還沒有事件。到 '}
          {view === 'recent' && <Link href="/timeline" className="sr-link">時間軸</Link>}
          {view === 'recent' && ' 看看。'}
        </p>
      ) : (
        <ul className="sr-stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 'var(--sr-space-1)' }}>
          {items.map((e) => (
            <li key={e.id} className="sr-row" style={{ justifyContent: 'space-between', gap: 'var(--sr-space-2)' }}>
              <span style={{ fontSize: 'var(--sr-text-sm)' }}>{e.title || e.event_type}</span>
              <span className="sr-muted" style={{ fontSize: 'var(--sr-text-xs)', whiteSpace: 'nowrap' }}>
                {new Date(e.occurred_at).toLocaleDateString('zh-TW')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
