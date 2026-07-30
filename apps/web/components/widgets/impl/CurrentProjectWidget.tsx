'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { WidgetProps } from '../types'

type Project = { id: string; name: string; description: string | null; status: string; last_activity_at: string | null }
type DesignFile = { id: string; title: string; created_at: string }

const STATUS_LABEL: Record<string, string> = { active: '進行中', paused: '暫停', done: '完成', archived: '封存' }

/** 目前專案：顯示指定或最近活動的專案。資料來自 /api/projects（可選帶專案作品概況）。 */
export default function CurrentProjectWidget({ spaceId, config }: WidgetProps) {
  const cfg = config as { projectId?: string | null; showProgress?: boolean; showRecentAssets?: boolean } | null
  const projectId = cfg?.projectId ?? null
  const showProgress = cfg?.showProgress ?? true
  const showRecentAssets = cfg?.showRecentAssets ?? true
  const [project, setProject] = useState<Project | null>(null)
  const [files, setFiles] = useState<DesignFile[] | null>(null)
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

  // 專案作品概況（進度統計 / 近期作品）——只有開了相關設定才抓
  useEffect(() => {
    if (!project || (!showProgress && !showRecentAssets)) {
      setFiles(null)
      return
    }
    let alive = true
    fetch(`/api/design/files?projectId=${project.id}&limit=20`, { headers: { 'x-space-id': spaceId } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((json: { data?: DesignFile[] }) => {
        if (alive) setFiles(json.data ?? [])
      })
      .catch(() => alive && setFiles([]))
    return () => {
      alive = false
    }
  }, [spaceId, project, showProgress, showRecentAssets])

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

      {showProgress && files && (
        <p className="sr-muted" style={{ marginTop: 'var(--sr-space-2)', marginBottom: 0, fontSize: 'var(--sr-text-xs)' }}>
          共 {files.length} 件作品{files.length >= 20 ? '+' : ''}
        </p>
      )}

      {showRecentAssets && files && files.length > 0 && (
        <ul
          className="sr-stack"
          style={{ listStyle: 'none', margin: 'var(--sr-space-2) 0 0', padding: 0, gap: 2 }}
        >
          {files.slice(0, 3).map((f) => (
            <li key={f.id} style={{ minWidth: 0 }}>
              <Link
                href={`/works?work=${f.id}`}
                className="sr-link"
                style={{ fontSize: 'var(--sr-text-xs)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                · {f.title || '（未命名）'}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
