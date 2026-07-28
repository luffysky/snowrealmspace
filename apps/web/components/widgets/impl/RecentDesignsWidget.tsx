'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { WidgetProps } from '../types'

type DesignFile = { id: string; title: string; provider: string | null; created_at: string }

/** 最近作品：最近放進來的 design_files。資料來自 /api/design/files。 */
export default function RecentDesignsWidget({ spaceId, config }: WidgetProps) {
  const limit = (config as { limit?: number } | null)?.limit ?? 6
  const [items, setItems] = useState<DesignFile[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading')

  useEffect(() => {
    let alive = true
    fetch('/api/design/files', { headers: { 'x-space-id': spaceId } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((json: { data?: DesignFile[] }) => {
        if (!alive) return
        const list = (json.data ?? []).slice(0, limit)
        setItems(list)
        setState(list.length ? 'ready' : 'empty')
      })
      .catch(() => alive && setState('error'))
    return () => {
      alive = false
    }
  }, [spaceId, limit])

  if (state === 'loading') return <div className="sr-card sr-widget" aria-busy="true"><span className="sr-muted">載入作品…</span></div>
  if (state === 'error') return <div className="sr-card sr-widget"><p className="sr-muted" style={{ margin: 0 }}>讀不到作品。</p></div>

  return (
    <div className="sr-card sr-widget">
      <h3 className="sr-widget-title">最近作品</h3>
      {state === 'empty' ? (
        <p className="sr-muted" style={{ margin: 0 }}>還沒有作品。到 <Link href="/works" className="sr-link">作品</Link> 加一個。</p>
      ) : (
        <ul className="sr-stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 'var(--sr-space-1)' }}>
          {items.map((d) => (
            <li key={d.id} className="sr-row" style={{ justifyContent: 'space-between', gap: 'var(--sr-space-2)' }}>
              <Link href={`/works?work=${d.id}`} className="sr-link" style={{ fontSize: 'var(--sr-text-sm)' }}>
                {d.title || '（未命名）'}
              </Link>
              <span className="sr-muted" style={{ fontSize: 'var(--sr-text-xs)' }}>
                {d.provider ?? new Date(d.created_at).toLocaleDateString('zh-TW')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
