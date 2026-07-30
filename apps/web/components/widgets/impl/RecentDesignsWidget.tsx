'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { WidgetProps } from '../types'

type DesignFile = { id: string; title: string; provider: string | null; created_at: string }

/** 最近作品：最近放進來的 design_files。資料來自 /api/design/files。 */
export default function RecentDesignsWidget({ spaceId, config }: WidgetProps) {
  const cfg = config as { limit?: number; projectId?: string | null; layout?: 'grid' | 'carousel' } | null
  const limit = cfg?.limit ?? 6
  const projectId = cfg?.projectId ?? null
  const layout = cfg?.layout ?? 'grid'
  const [items, setItems] = useState<DesignFile[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading')

  useEffect(() => {
    let alive = true
    const params = new URLSearchParams({ limit: String(limit) })
    if (projectId) params.set('projectId', projectId)
    fetch(`/api/design/files?${params}`, { headers: { 'x-space-id': spaceId } })
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
  }, [spaceId, limit, projectId])

  if (state === 'loading') return <div className="sr-card sr-widget" aria-busy="true"><span className="sr-muted">載入作品…</span></div>
  if (state === 'error') return <div className="sr-card sr-widget"><p className="sr-muted" style={{ margin: 0 }}>讀不到作品。</p></div>

  return (
    <div className="sr-card sr-widget">
      <h3 className="sr-widget-title">最近作品</h3>
      {state === 'empty' ? (
        <p className="sr-muted" style={{ margin: 0 }}>
          {projectId ? '這個專案還沒有作品。' : <>還沒有作品。到 <Link href="/works" className="sr-link">作品</Link> 加一個。</>}
        </p>
      ) : layout === 'carousel' ? (
        // 橫向捲動一排卡片
        <div
          className="sr-row"
          style={{ overflowX: 'auto', gap: 'var(--sr-space-2)', paddingBottom: 4, flexWrap: 'nowrap' }}
        >
          {items.map((d) => (
            <Link
              key={d.id}
              href={`/works?work=${d.id}`}
              className="sr-card"
              style={{ minWidth: 120, flex: '0 0 auto', padding: 'var(--sr-space-2)', textDecoration: 'none' }}
            >
              <span style={{ display: 'block', fontSize: 'var(--sr-text-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {d.title || '（未命名）'}
              </span>
              <span className="sr-muted" style={{ fontSize: 'var(--sr-text-xs)' }}>
                {d.provider ?? new Date(d.created_at).toLocaleDateString('zh-TW')}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        // grid：自動填欄的卡片格線
        <div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 'var(--sr-space-2)' }}
        >
          {items.map((d) => (
            <Link
              key={d.id}
              href={`/works?work=${d.id}`}
              className="sr-card"
              style={{ padding: 'var(--sr-space-2)', textDecoration: 'none', minWidth: 0 }}
            >
              <span style={{ display: 'block', fontSize: 'var(--sr-text-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {d.title || '（未命名）'}
              </span>
              <span className="sr-muted" style={{ fontSize: 'var(--sr-text-xs)' }}>
                {d.provider ?? new Date(d.created_at).toLocaleDateString('zh-TW')}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
