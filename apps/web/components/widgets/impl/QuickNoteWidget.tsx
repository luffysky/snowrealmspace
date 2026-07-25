'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { WidgetProps } from '../types'

/**
 * 隨手記（CRUD）。從單格擴充成多則筆記，存到 notes 表（走 RLS，跨裝置）。
 * 小工具裡放「快速新增 + 最近幾則（可刪）」，完整增刪改到 /notes。
 * 狀態誠實：載入/儲存失敗都明說，不假裝成功。
 */

type Note = { id: string; body: string; updated_at: string }
type State = 'loading' | 'idle' | 'load-error'

const RECENT = 5

export default function QuickNoteWidget({ spaceId, config }: WidgetProps) {
  const placeholder = (config as { placeholder?: string } | null)?.placeholder ?? '隨手記下…'
  const [state, setState] = useState<State>('loading')
  const [notes, setNotes] = useState<Note[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setState('loading')
    fetch('/api/notes', { headers: { 'x-space-id': spaceId } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((b: { data: Note[] }) => {
        if (!alive) return
        setNotes(b.data)
        setState('idle')
      })
      .catch(() => {
        if (alive) setState('load-error')
      })
    return () => {
      alive = false
    }
  }, [spaceId])

  async function add() {
    const body = draft.trim()
    if (!body || busy) return
    setBusy(true)
    setErr(null)
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-space-id': spaceId },
        body: JSON.stringify({ body }),
      })
      if (!res.ok) throw new Error()
      const b = (await res.json()) as { data: Note }
      setNotes((prev) => [b.data, ...prev])
      setDraft('')
    } catch {
      setErr('存不了，請再試一次。')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    const prev = notes
    setNotes((p) => p.filter((n) => n.id !== id))
    try {
      const res = await fetch(`/api/notes/${id}`, { method: 'DELETE', headers: { 'x-space-id': spaceId } })
      if (!res.ok) throw new Error()
    } catch {
      setNotes(prev)
      setErr('刪除失敗，請重試。')
    }
  }

  return (
    <div className="sr-card sr-widget">
      <h3 className="sr-widget-title">隨手記</h3>

      {state === 'load-error' ? (
        <p className="sr-muted" style={{ color: 'var(--sr-danger)', margin: 0 }}>
          讀不到雲端筆記，請重新整理。
        </p>
      ) : (
        <>
          <textarea
            className="sr-input"
            rows={2}
            value={draft}
            maxLength={10000}
            placeholder={placeholder}
            disabled={state === 'loading'}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                void add()
              }
            }}
          />
          <div className="sr-row" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
            <Link href="/notes" className="sr-link" style={{ fontSize: 'var(--sr-text-sm)' }}>
              看全部 / 編輯
            </Link>
            <button type="button" className="sr-button" style={{ padding: '2px 12px' }} onClick={() => void add()} disabled={busy || !draft.trim()}>
              新增
            </button>
          </div>

          {err && <p className="sr-muted" style={{ color: 'var(--sr-danger)', margin: '4px 0 0', fontSize: 'var(--sr-text-sm)' }}>{err}</p>}

          {notes.length > 0 && (
            <ul className="sr-stack" style={{ listStyle: 'none', margin: 'var(--sr-space-2) 0 0', padding: 0, gap: '4px' }}>
              {notes.slice(0, RECENT).map((n) => (
                <li key={n.id} className="sr-row" style={{ gap: '4px', alignItems: 'flex-start' }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--sr-text-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {n.body}
                  </span>
                  <button type="button" className="sr-button sr-button-secondary" style={{ padding: '0 6px', fontSize: 'var(--sr-text-sm)' }} onClick={() => void remove(n.id)} aria-label="刪除這則">
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
