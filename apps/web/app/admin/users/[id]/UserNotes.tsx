'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export type Note = { id: string; body: string; author_id: string | null; created_at: string }

/**
 * 使用者 CRM 註記（站台管理員內部用）。新增/刪除，走 /api/admin/user-notes。
 */
export function UserNotes({ subjectUserId, initial }: { subjectUserId: string; initial: Note[] }) {
  const router = useRouter()
  const [notes, setNotes] = useState<Note[]>(initial)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function add() {
    if (!body.trim()) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/user-notes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subjectUserId, body }),
      })
      const json: { data?: Note; error?: { message?: string } } = await res.json()
      if (!res.ok || !json.data) throw new Error(json.error?.message ?? '新增失敗')
      setNotes((n) => [json.data!, ...n])
      setBody('')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '新增失敗')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    const before = notes
    setNotes((n) => n.filter((x) => x.id !== id))
    try {
      const res = await fetch(`/api/admin/user-notes?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
    } catch {
      setNotes(before)
    }
  }

  return (
    <div>
      <div className="sr-row" style={{ gap: 'var(--sr-space-2)', alignItems: 'flex-start' }}>
        <textarea
          className="sr-input"
          style={{ flex: 1, minHeight: 44 }}
          placeholder="留一則內部註記（客服/追蹤用）…"
          value={body}
          disabled={busy}
          onChange={(e) => setBody(e.target.value)}
        />
        <button type="button" className="sr-button" disabled={busy || !body.trim()} onClick={() => void add()}>
          {busy ? '…' : '新增'}
        </button>
      </div>
      {error && <p className="sr-muted" style={{ margin: '6px 0 0', color: 'var(--sr-danger)' }}>{error}</p>}

      {notes.length > 0 && (
        <ul className="sr-stack" style={{ listStyle: 'none', margin: 'var(--sr-space-3) 0 0', padding: 0, gap: 'var(--sr-space-2)' }}>
          {notes.map((n) => (
            <li key={n.id} className="sr-row" style={{ justifyContent: 'space-between', gap: 'var(--sr-space-2)', alignItems: 'flex-start', borderTop: '1px solid var(--sr-border)', paddingTop: 'var(--sr-space-2)' }}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 'var(--sr-text-sm)', whiteSpace: 'pre-wrap' }}>{n.body}</p>
                <span className="sr-muted" style={{ fontSize: 'var(--sr-text-xs)' }}>{new Date(n.created_at).toLocaleString('zh-TW')}</span>
              </div>
              <button type="button" className="sr-button sr-button-secondary" style={{ padding: '1px 8px', fontSize: 'var(--sr-text-xs)', color: 'var(--sr-danger)' }} onClick={() => void remove(n.id)}>
                刪除
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
