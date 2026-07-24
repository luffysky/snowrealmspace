'use client'

import { useState } from 'react'

export type PrincipleRow = {
  id: string
  title: string
  body: string | null
  category: string | null
  position: number
  created_at: string
  updated_at: string
}

export function PrinciplesClient({
  spaceId,
  initialPrinciples,
}: {
  spaceId: string
  initialPrinciples: PrincipleRow[]
}) {
  const [items, setItems] = useState<PrincipleRow[]>(initialPrinciples)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const headers = { 'x-space-id': spaceId, 'content-type': 'application/json' }

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setBusy(true)
    try {
      const res = await fetch('/api/design-principles', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim() || null,
          category: category.trim() || null,
        }),
      })
      if (!res.ok) {
        setNotice('✕ 新增失敗。')
        return
      }
      const b = (await res.json()) as { data: PrincipleRow }
      setItems((prev) => [...prev, b.data])
      setTitle('')
      setBody('')
      setCategory('')
    } finally {
      setBusy(false)
    }
  }

  async function edit(p: PrincipleRow) {
    const t = window.prompt('原則', p.title)
    if (t === null || !t.trim()) return
    const bd = window.prompt('說明（可留空）', p.body ?? '')
    const res = await fetch(`/api/design-principles/${p.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ title: t.trim(), body: (bd ?? '').trim() || null }),
    })
    if (res.ok) {
      const b = (await res.json()) as { data: PrincipleRow }
      setItems((prev) => prev.map((x) => (x.id === p.id ? b.data : x)))
    }
  }

  async function remove(p: PrincipleRow) {
    if (!window.confirm(`刪除「${p.title}」？`)) return
    const res = await fetch(`/api/design-principles/${p.id}`, { method: 'DELETE', headers })
    if (res.ok) setItems((prev) => prev.filter((x) => x.id !== p.id))
  }

  async function move(index: number, dir: -1 | 1) {
    const next = index + dir
    if (next < 0 || next >= items.length) return
    const reordered = [...items]
    const tmp = reordered[index]!
    reordered[index] = reordered[next]!
    reordered[next] = tmp
    setItems(reordered)
    await fetch('/api/design-principles/reorder', {
      method: 'POST',
      headers,
      body: JSON.stringify({ orderedIds: reordered.map((x) => x.id) }),
    })
  }

  return (
    <div className="sr-stack">
      {notice && (
        <p className="sr-message sr-message-info" role="status">
          {notice}
        </p>
      )}

      <form className="sr-card sr-stack" onSubmit={add}>
        <h2 className="sr-section-title">新增一條原則</h2>
        <label className="sr-field">
          <span>原則</span>
          <input
            className="sr-input"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例：留白比內容更重要"
          />
        </label>
        <div className="sr-form-cols">
          <label className="sr-field">
            <span>分類（可留空）</span>
            <input
              className="sr-input"
              value={category}
              maxLength={40}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="排版／配色／字體…"
            />
          </label>
        </div>
        <label className="sr-field">
          <span>說明（可留空）</span>
          <textarea
            className="sr-input"
            rows={2}
            value={body}
            maxLength={2000}
            onChange={(e) => setBody(e.target.value)}
          />
        </label>
        <div className="sr-btn-row">
          <button type="submit" className="sr-button" disabled={busy || !title.trim()}>
            新增
          </button>
        </div>
      </form>

      {items.length === 0 ? (
        <p className="sr-muted" style={{ padding: 'var(--sr-space-4) 0' }}>
          還沒有設計原則。寫下第一條 —— 它會慢慢長成你的創作準則。
        </p>
      ) : (
        <ul className="sr-stack" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {items.map((p, i) => (
            <li key={p.id} className="sr-card sr-stack" style={{ gap: 'var(--sr-space-2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--sr-space-2)', flexWrap: 'wrap' }}>
                <strong>{p.title}</strong>
                {p.category && <span className="sr-chip sr-chip-tag">{p.category}</span>}
              </div>
              {p.body && <p className="sr-muted" style={{ margin: 0 }}>{p.body}</p>}
              <div className="sr-btn-row">
                <button type="button" className="sr-timeline-action" onClick={() => void move(i, -1)} disabled={i === 0} aria-label="上移">
                  ↑
                </button>
                <button type="button" className="sr-timeline-action" onClick={() => void move(i, 1)} disabled={i === items.length - 1} aria-label="下移">
                  ↓
                </button>
                <button type="button" className="sr-timeline-action" onClick={() => void edit(p)}>
                  編輯
                </button>
                <button type="button" className="sr-timeline-action" onClick={() => void remove(p)}>
                  刪除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
