'use client'

import { useState } from 'react'
import { RichEditor } from '@/components/rich/RichEditor'
import { RichHtml } from '@/components/rich/RichHtml'

export type Note = {
  id: string
  title: string | null
  body: string
  created_at: string
  updated_at: string
}

/** 空內容判定：tiptap 空文件是 <p></p>；有 GIF（img）就不算空。 */
function isEmptyHtml(html: string): boolean {
  if (/<img\b/i.test(html)) return false
  return !html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
}

/** 筆記 CRUD：新增、就地編輯、刪除。狀態誠實：失敗有訊息、不假裝成功。 */
export function NotesManager({ spaceId, initial }: { spaceId: string; initial: Note[] }) {
  const [notes, setNotes] = useState<Note[]>(initial)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [err, setErr] = useState<string | null>(null)

  async function add() {
    const body = draft
    if (isEmptyHtml(draft) || busy) return
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
      setErr('新增失敗，請再試一次。')
    } finally {
      setBusy(false)
    }
  }

  async function saveEdit(id: string) {
    const body = editBody
    if (isEmptyHtml(editBody)) return
    setErr(null)
    const prev = notes
    setNotes((p) => p.map((n) => (n.id === id ? { ...n, body } : n)))
    setEditingId(null)
    try {
      const res = await fetch(`/api/notes/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-space-id': spaceId },
        body: JSON.stringify({ body }),
      })
      if (!res.ok) throw new Error()
      const b = (await res.json()) as { data: Note }
      setNotes((p) => p.map((n) => (n.id === id ? b.data : n)))
    } catch {
      setNotes(prev)
      setErr('更新失敗，請重新整理。')
    }
  }

  async function remove(id: string) {
    setErr(null)
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
    <div className="sr-stack">
      <section className="sr-card">
        <label className="sr-visually-hidden">新筆記</label>
        <RichEditor value={draft} onChange={setDraft} placeholder="寫點什麼…（可加粗體、表情、GIF）" />
        <div className="sr-row" style={{ justifyContent: 'flex-end', marginTop: 'var(--sr-space-2)' }}>
          <button type="button" className="sr-button" onClick={() => void add()} disabled={busy || isEmptyHtml(draft)}>
            新增筆記
          </button>
        </div>
        {err && <p className="sr-muted" role="status" style={{ margin: '4px 0 0' }}>{err}</p>}
      </section>

      <section className="sr-card">
        <h2 className="sr-section-title">筆記（{notes.length}）</h2>
        {notes.length === 0 ? (
          <p className="sr-muted" style={{ margin: 0 }}>還沒有筆記。想到什麼就寫進來。</p>
        ) : (
          <ul className="sr-stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 'var(--sr-space-2)' }}>
            {notes.map((n) => (
              <li key={n.id} className="sr-card" style={{ padding: 'var(--sr-space-3)' }}>
                {editingId === n.id ? (
                  <>
                    <RichEditor value={editBody} onChange={setEditBody} />
                    <div className="sr-row" style={{ gap: '4px', marginTop: '4px', justifyContent: 'flex-end' }}>
                      <button type="button" className="sr-button" style={{ padding: '2px 10px' }} onClick={() => void saveEdit(n.id)}>儲存</button>
                      <button type="button" className="sr-button sr-button-secondary" style={{ padding: '2px 10px' }} onClick={() => setEditingId(null)}>取消</button>
                    </div>
                  </>
                ) : (
                  <>
                    <RichHtml html={n.body} />
                    <div className="sr-row" style={{ gap: '4px', marginTop: 'var(--sr-space-2)', alignItems: 'center' }}>
                      <span className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)' }}>{n.updated_at.slice(0, 10)}</span>
                      <button type="button" className="sr-button sr-button-secondary" style={{ padding: '2px 10px', marginLeft: 'auto' }} onClick={() => { setEditingId(n.id); setEditBody(n.body) }}>編輯</button>
                      <button type="button" className="sr-button sr-button-secondary" style={{ padding: '2px 10px' }} onClick={() => void remove(n.id)} aria-label="刪除">✕</button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
