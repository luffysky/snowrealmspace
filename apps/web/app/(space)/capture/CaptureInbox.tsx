'use client'

import { useState } from 'react'
import { RichEditor } from '@/components/rich/RichEditor'
import { RichHtml } from '@/components/rich/RichHtml'

/** 空內容判定：tiptap 空文件是 <p></p>；有 GIF（img）不算空。 */
function isEmptyHtml(html: string): boolean {
  if (/<img\b/i.test(html)) return false
  return !html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
}

export type CaptureRow = {
  id: string
  body: string
  source: string
  status: string
  created_at: string
}

const SOURCE_LABEL: Record<string, string> = {
  web: '',
  yukiboard: '⌨ 鍵盤',
  agent: '🤖 Agent',
}

export function CaptureInbox({ spaceId, initial }: { spaceId: string; initial: CaptureRow[] }) {
  const [items, setItems] = useState<CaptureRow[]>(initial)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 已封存清單（可還原回 inbox）。之前 restore 端點做好卻沒有地方看已封存的念頭。
  const [showArchived, setShowArchived] = useState(false)
  const [archived, setArchived] = useState<CaptureRow[] | null>(null)

  async function toggleArchived() {
    const next = !showArchived
    setShowArchived(next)
    if (next && archived === null) {
      try {
        const res = await fetch('/api/capture?status=archived', { headers: { 'x-space-id': spaceId } })
        const b = (await res.json()) as { data: CaptureRow[] }
        setArchived(res.ok ? b.data : [])
      } catch {
        setArchived([])
      }
    }
  }

  async function restore(id: string) {
    setError(null)
    const prev = archived ?? []
    const item = prev.find((i) => i.id === id)
    setArchived(prev.filter((i) => i.id !== id))
    try {
      const res = await fetch(`/api/capture/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-space-id': spaceId },
        body: JSON.stringify({ action: 'restore' }),
      })
      if (!res.ok) throw new Error()
      if (item) setItems((p) => [{ ...item, status: 'inbox' }, ...p])
      setError('已放回 Inbox。')
    } catch {
      setArchived(prev)
      setError('還原失敗，請重試。')
    }
  }

  async function add() {
    const body = draft
    if (isEmptyHtml(draft) || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-space-id': spaceId },
        body: JSON.stringify({ body }),
      })
      if (!res.ok) throw new Error()
      const b = (await res.json()) as { data: CaptureRow }
      setItems((prev) => [b.data, ...prev])
      setDraft('')
    } catch {
      setError('存不了，請再試一次。')
    } finally {
      setBusy(false)
    }
  }

  async function act(id: string, action: 'to_note' | 'archive', successMsg: string) {
    setError(null)
    const prev = items
    setItems((p) => p.filter((i) => i.id !== id)) // 樂觀移出 inbox
    try {
      const res = await fetch(`/api/capture/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-space-id': spaceId },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error()
      setError(successMsg)
    } catch {
      setItems(prev) // 失敗放回
      setError('處理失敗，請重試。')
    }
  }

  async function remove(id: string) {
    setError(null)
    const prev = items
    setItems((p) => p.filter((i) => i.id !== id))
    try {
      const res = await fetch(`/api/capture/${id}`, { method: 'DELETE', headers: { 'x-space-id': spaceId } })
      if (!res.ok) throw new Error()
    } catch {
      setItems(prev)
      setError('刪除失敗，請重試。')
    }
  }

  return (
    <div className="sr-stack">
      <section className="sr-card">
        <label className="sr-visually-hidden">要捕捉的內容</label>
        <RichEditor value={draft} onChange={setDraft} placeholder="現在在想什麼？丟進來就好，之後再整理。" />
        <div className="sr-row" style={{ justifyContent: 'flex-end', marginTop: 'var(--sr-space-2)' }}>
          <button type="button" className="sr-button" onClick={() => void add()} disabled={busy || isEmptyHtml(draft)}>
            捕捉
          </button>
        </div>
        {error && (
          <p className="sr-muted" role="status" style={{ margin: '4px 0 0' }}>
            {error}
          </p>
        )}
      </section>

      <section className="sr-card">
        <h2 className="sr-section-title">Inbox（{items.length}）</h2>
        {items.length === 0 ? (
          <p className="sr-muted" style={{ margin: 0 }}>
            清空了。這裡乾淨的時候，代表念頭都沉澱好了。
          </p>
        ) : (
          <ul className="sr-stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 'var(--sr-space-2)' }}>
            {items.map((it) => (
              <li key={it.id} className="sr-card" style={{ padding: 'var(--sr-space-3)' }}>
                <RichHtml html={it.body} />
                <div className="sr-row" style={{ gap: 'var(--sr-space-2)', marginTop: 'var(--sr-space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                  {SOURCE_LABEL[it.source] && (
                    <span className="sr-chip sr-chip-tag">{SOURCE_LABEL[it.source]}</span>
                  )}
                  <button type="button" className="sr-button sr-button-secondary" style={{ padding: '2px 10px' }} onClick={() => void act(it.id, 'to_note', '已沉澱成一則筆記。')}>
                    → 筆記
                  </button>
                  <button type="button" className="sr-button sr-button-secondary" style={{ padding: '2px 10px' }} onClick={() => void act(it.id, 'archive', '已收起來。')}>
                    封存
                  </button>
                  <button type="button" className="sr-button sr-button-secondary" style={{ padding: '2px 10px', marginLeft: 'auto' }} onClick={() => void remove(it.id)} aria-label="刪除">
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="sr-card">
        <button
          type="button"
          className="sr-button sr-button-secondary"
          onClick={() => void toggleArchived()}
          aria-expanded={showArchived}
        >
          {showArchived ? '收起已封存' : '看已封存的念頭'}
        </button>

        {showArchived && (
          archived === null ? (
            <p className="sr-muted" style={{ margin: 'var(--sr-space-2) 0 0' }}>載入中…</p>
          ) : archived.length === 0 ? (
            <p className="sr-muted" style={{ margin: 'var(--sr-space-2) 0 0' }}>沒有已封存的念頭。</p>
          ) : (
            <ul className="sr-stack" style={{ listStyle: 'none', margin: 'var(--sr-space-2) 0 0', padding: 0, gap: 'var(--sr-space-2)' }}>
              {archived.map((it) => (
                <li key={it.id} className="sr-card" style={{ padding: 'var(--sr-space-3)' }}>
                  <RichHtml html={it.body} />
                  <div className="sr-row" style={{ gap: 'var(--sr-space-2)', marginTop: 'var(--sr-space-2)', alignItems: 'center' }}>
                    <button type="button" className="sr-button sr-button-secondary" style={{ padding: '2px 10px', marginLeft: 'auto' }} onClick={() => void restore(it.id)}>
                      放回 Inbox
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )
        )}
      </section>
    </div>
  )
}
