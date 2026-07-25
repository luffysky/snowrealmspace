'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { WidgetProps } from '../types'

type Project = { id: string; name: string; description: string | null; status: string; last_activity_at: string | null }

const STATUS_LABEL: Record<string, string> = { active: '進行中', paused: '暫停', done: '完成', archived: '封存' }

/** 目前專案：顯示指定或最近活動的專案。資料來自 /api/projects。 */
export default function CurrentProjectWidget({ spaceId, config }: WidgetProps) {
  const projectId = (config as { projectId?: string | null } | null)?.projectId ?? null
  const [project, setProject] = useState<Project | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading')

  useEffect(() => {
    let alive = true
    fetch('/api/projects', { headers: { 'x-space-id': spaceId } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((json: { data?: Project[] }) => {
        if (!alive) return
        const list = json.data ?? []
        const pick = projectId ? list.find((p) => p.id === projectId) : list[0]
        if (!pick) return setState('empty')
        setProject(pick)
        setState('ready')
      })
      .catch(() => alive && setState('error'))
    return () => {
      alive = false
    }
  }, [spaceId, projectId])

  if (state === 'loading') return <div className="sr-card sr-widget" aria-busy="true"><span className="sr-muted">載入專案…</span></div>
  if (state === 'error') return <div className="sr-card sr-widget"><p className="sr-muted" style={{ margin: 0 }}>讀不到專案。</p></div>
  if (state === 'empty' || !project)
    return (
      <div className="sr-card sr-widget">
        <h3 className="sr-widget-title">目前專案</h3>
        <p className="sr-muted" style={{ margin: 0 }}>還沒有專案。到 <Link href="/projects" className="sr-link">專案</Link> 開一個。</p>
      </div>
    )

  return (
    <div className="sr-card sr-widget">
      <h3 className="sr-widget-title">目前專案</h3>
      <Link href={`/projects/${project.id}`} className="sr-link" style={{ fontSize: 'var(--sr-text-lg)', fontWeight: 600 }}>
        {project.name}
      </Link>
      <span className="sr-badge" style={{ marginLeft: 'var(--sr-space-2)', fontSize: 'var(--sr-text-xs)' }}>
        {STATUS_LABEL[project.status] ?? project.status}
      </span>
      {project.description && (
        <p className="sr-muted" style={{ marginTop: 'var(--sr-space-2)', marginBottom: 0, fontSize: 'var(--sr-text-sm)' }}>
          {project.description}
        </p>
      )}
      {project.last_activity_at && (
        <p className="sr-muted" style={{ marginTop: 'var(--sr-space-2)', marginBottom: 0, fontSize: 'var(--sr-text-xs)' }}>
          最後活動：{new Date(project.last_activity_at).toLocaleDateString('zh-TW')}
        </p>
      )}
    </div>
  )
}
