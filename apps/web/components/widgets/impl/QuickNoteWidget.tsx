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

export default function QuickNoteWidget({ spaceId, instanceId, config }: WidgetProps) {
  const cfg = config as
    | { placeholder?: string; autoSaveSeconds?: number; targetProjectId?: string | null }
    | null
  const placeholder = cfg?.placeholder ?? '隨手記下…'
  const autoSaveSeconds = cfg?.autoSaveSeconds ?? 5
  const targetProjectId = cfg?.targetProjectId ?? null
  const draftKey = `sr:quicknote-draft:${instanceId}`
  const [state, setState] = useState<State>('loading')
  const [notes, setNotes] = useState<Note[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [savedDraft, setSavedDraft] = useState(false)

  useEffect(() => {
    let alive = true
    setState('loading')
    // 還原上次沒送出的草稿（autoSave 把草稿存在 localStorage，換裝置/重整不會白打）
    try {
      const saved = localStorage.getItem(draftKey)
      if (saved) setDraft(saved)
    } catch {
      /* localStorage 不可用時略過 */
    }
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
  }, [spaceId, draftKey])

  // 草稿自動存：停止打字 autoSaveSeconds 秒後把草稿寫進 localStorage
  useEffect(() => {
    if (state === 'loading') return
    setSavedDraft(false)
    const t = setTimeout(() => {
      try {
        if (draft.trim()) {
          localStorage.setItem(draftKey, draft)
          setSavedDraft(true)
        } else {
          localStorage.removeItem(draftKey)
        }
      } catch {
        /* 略過 */
      }
    }, Math.max(2, autoSaveSeconds) * 1000)
    return () => clearTimeout(t)
  }, [draft, autoSaveSeconds, draftKey, state])

  async function add() {
    const body = draft.trim()
    if (!body || busy) return
    setBusy(true)
    setErr(null)
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-space-id': spaceId },
        body: JSON.stringify(targetProjectId ? { body, projectId: targetProjectId } : { body }),
      })
      if (!res.ok) throw new Error()
      const b = (await res.json()) as { data: Note }
      setNotes((prev) => [b.data, ...prev])
      setDraft('')
      setSavedDraft(false)
      try {
        localStorage.removeItem(draftKey)
      } catch {
        /* 略過 */
      }
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
            <span className="sr-row" style={{ gap: 'var(--sr-space-2)', alignItems: 'center' }}>
              <Link href="/notes" className="sr-link" style={{ fontSize: 'var(--sr-text-sm)' }}>
                看全部 / 編輯
              </Link>
              {savedDraft && (
                <span className="sr-muted" style={{ fontSize: 'var(--sr-text-xs)' }} aria-live="polite">
                  已存草稿
                </span>
              )}
            </span>
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
