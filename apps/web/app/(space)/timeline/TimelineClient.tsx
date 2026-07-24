'use client'

import { useCallback, useEffect, useState } from 'react'
import { TIMELINE_VIEWS, type TimelineView, type TimelineVisibility } from '@snowrealm/validation'

export type TimelineRow = {
  id: string
  event_type: string
  title: string
  body: string | null
  cover_asset_id: string | null
  project_id: string | null
  visibility: TimelineVisibility
  occurred_at: string
}
export type ProjectLabel = { id: string; name: string }

const VIEW_LABEL: Record<TimelineView, string> = {
  chronological: '時間順序',
  project: '依專案',
  on_this_day: '當年今日',
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })
}

export function TimelineClient({
  spaceId,
  initialEvents,
  projects,
}: {
  spaceId: string
  initialEvents: TimelineRow[]
  projects: ProjectLabel[]
}) {
  const [view, setView] = useState<TimelineView>('chronological')
  const [events, setEvents] = useState<TimelineRow[]>(initialEvents)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const headers = { 'x-space-id': spaceId }
  const patchHeaders = { ...headers, 'content-type': 'application/json' }
  const projectName = (id: string | null) =>
    id ? (projects.find((p) => p.id === id)?.name ?? '未命名專案') : '未歸屬'

  const load = useCallback(
    async (v: TimelineView) => {
      setLoading(true)
      try {
        const res = await fetch(`/api/timeline?view=${v}&limit=100`, { headers })
        if (!res.ok) return
        const body = (await res.json()) as { data: TimelineRow[] }
        setEvents(body.data)
      } finally {
        setLoading(false)
      }
    },
    // headers 內容穩定，不放入依賴
    [spaceId],
  )

  useEffect(() => {
    void load(view)
  }, [view, load])

  async function patch(row: TimelineRow, body: Record<string, unknown>) {
    const res = await fetch(`/api/timeline/${row.id}`, {
      method: 'PATCH',
      headers: patchHeaders,
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      setNotice('✕ 更新失敗。')
      return
    }
    const b = (await res.json()) as { data: TimelineRow }
    setEvents((prev) => prev.map((e) => (e.id === row.id ? { ...e, ...b.data } : e)))
  }

  async function rename(row: TimelineRow) {
    const title = window.prompt('標題', row.title)
    if (title === null || !title.trim()) return
    await patch(row, { title: title.trim() })
  }

  async function toggleHide(row: TimelineRow) {
    await patch(row, { visibility: row.visibility === 'hidden' ? 'private' : 'hidden' })
    setNotice(row.visibility === 'hidden' ? '已取消隱藏。' : '已隱藏。')
  }

  async function remove(row: TimelineRow) {
    if (!window.confirm(`刪除「${row.title}」這筆時間軸？`)) return
    const res = await fetch(`/api/timeline/${row.id}`, { method: 'DELETE', headers })
    if (!res.ok) {
      setNotice('✕ 刪除失敗。')
      return
    }
    setEvents((prev) => prev.filter((e) => e.id !== row.id))
    setNotice('已刪除。')
  }

  // 依專案分組
  const grouped =
    view === 'project'
      ? Array.from(
          events.reduce((map, e) => {
            const key = e.project_id ?? '__none__'
            if (!map.has(key)) map.set(key, [])
            map.get(key)!.push(e)
            return map
          }, new Map<string, TimelineRow[]>()),
        )
      : null

  function Item({ row }: { row: TimelineRow }) {
    const hidden = row.visibility === 'hidden'
    return (
      <li className={`sr-timeline-item${hidden ? ' sr-timeline-hidden' : ''}`}>
        <div className="sr-timeline-dot" aria-hidden="true" />
        <div className="sr-stack" style={{ gap: 'var(--sr-space-1)' }}>
          <div style={{ display: 'flex', gap: 'var(--sr-space-2)', alignItems: 'baseline', flexWrap: 'wrap' }}>
            <strong>{row.title}</strong>
            <span className="sr-muted">{fmtDate(row.occurred_at)}</span>
            {hidden && <span className="sr-chip sr-chip-tag">已隱藏</span>}
          </div>
          {row.body && <p className="sr-muted">{row.body}</p>}
          <div className="sr-btn-row">
            <button type="button" className="sr-timeline-action" onClick={() => void rename(row)}>
              改標題
            </button>
            <button type="button" className="sr-timeline-action" onClick={() => void toggleHide(row)}>
              {hidden ? '取消隱藏' : '隱藏'}
            </button>
            <button type="button" className="sr-timeline-action" onClick={() => void remove(row)}>
              刪除
            </button>
          </div>
        </div>
      </li>
    )
  }

  return (
    <div className="sr-stack">
      {notice && (
        <p className="sr-message sr-message-info" role="status">
          {notice}
        </p>
      )}

      <div className="sr-chip-row" role="group" aria-label="檢視方式">
        {TIMELINE_VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            className={`sr-chip${view === v ? ' sr-chip-active' : ''}`}
            onClick={() => setView(v)}
          >
            {VIEW_LABEL[v]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="sr-muted" aria-live="polite">
          載入中…
        </p>
      ) : events.length === 0 ? (
        <p className="sr-muted" style={{ padding: 'var(--sr-space-4) 0' }}>
          {view === 'on_this_day'
            ? '過往的今天還沒有紀錄。等這個空間陪你久一點，這裡就會有故事。'
            : '時間軸還是空的。做點什麼（建專案、上傳作品、換主題），它就會開始長出來。'}
        </p>
      ) : grouped ? (
        <div className="sr-stack">
          {grouped.map(([pid, rows]) => (
            <section key={pid} className="sr-card">
              <h2 className="sr-section-title">{projectName(pid === '__none__' ? null : pid)}</h2>
              <ul className="sr-timeline">
                {rows.map((r) => (
                  <Item key={r.id} row={r} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <ul className="sr-timeline sr-card">
          {events.map((r) => (
            <Item key={r.id} row={r} />
          ))}
        </ul>
      )}
    </div>
  )
}
