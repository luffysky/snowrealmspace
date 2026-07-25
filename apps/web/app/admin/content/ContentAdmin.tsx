'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export type ContentRow = {
  content_id: string
  kind: string
  label: string | null
  text: string
  enabled: boolean
  weight: number
  rarity: string | null
  tags: string[]
}

const KIND_LABEL: Record<string, string> = { quote: '語錄', prompt: '創作提示', greeting: '問候', surprise: '驚喜', chain: '生日鏈' }
const ADDABLE = ['quote', 'prompt', 'greeting', 'surprise'] as const

export function ContentAdmin({ initial }: { initial: ContentRow[] }) {
  const router = useRouter()
  const [rows, setRows] = useState<ContentRow[]>(initial)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState(false)

  // add form
  const [kind, setKind] = useState<(typeof ADDABLE)[number]>('quote')
  const [text, setText] = useState('')
  const [weight, setWeight] = useState('1')
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)

  function say(m: string, isErr = false) {
    setMsg(m)
    setError(isErr)
  }

  async function add() {
    if (!text.trim()) return
    setBusy(true)
    say('')
    try {
      const payload: Record<string, unknown> = { kind, text, weight: Number(weight) || 1 }
      if (kind === 'surprise') payload.label = label || '一個驚喜'
      const res = await fetch('/api/admin/content', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json: { data?: ContentRow; error?: { message?: string } } = await res.json()
      if (!res.ok || !json.data) throw new Error(json.error?.message ?? '新增失敗')
      setRows((r) => [json.data!, ...r])
      setText('')
      setLabel('')
      say('已新增。')
      router.refresh()
    } catch (e) {
      say(e instanceof Error ? e.message : '新增失敗', true)
    } finally {
      setBusy(false)
    }
  }

  async function patch(row: ContentRow, patch: { enabled?: boolean; text?: string; weight?: number }) {
    const before = rows
    setRows((rs) => rs.map((r) => (r.content_id === row.content_id ? { ...r, ...patch } : r)))
    try {
      const res = await fetch('/api/admin/content', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contentId: row.content_id, ...patch }),
      })
      if (!res.ok) {
        const j: { error?: { message?: string } } = await res.json()
        throw new Error(j.error?.message ?? '更新失敗')
      }
    } catch (e) {
      setRows(before)
      say(e instanceof Error ? e.message : '更新失敗', true)
    }
  }

  async function remove(row: ContentRow) {
    const before = rows
    setRows((rs) => rs.filter((r) => r.content_id !== row.content_id))
    try {
      const res = await fetch(`/api/admin/content?contentId=${encodeURIComponent(row.content_id)}`, { method: 'DELETE' })
      if (!res.ok) {
        const j: { error?: { message?: string } } = await res.json()
        throw new Error(j.error?.message ?? '刪除失敗')
      }
    } catch (e) {
      setRows(before)
      say(e instanceof Error ? e.message : '刪除失敗', true)
    }
  }

  const byKind = new Map<string, ContentRow[]>()
  for (const r of rows) {
    const l = byKind.get(r.kind) ?? []
    l.push(r)
    byKind.set(r.kind, l)
  }

  return (
    <>
      <section className="sr-card" style={{ marginTop: 'var(--sr-space-4)' }}>
        <h2 className="sr-section-title">新增文案</h2>
        <div className="sr-row" style={{ gap: 'var(--sr-space-2)', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <select className="sr-input" style={{ flex: '0 0 auto' }} value={kind} disabled={busy} onChange={(e) => setKind(e.target.value as typeof kind)}>
            {ADDABLE.map((k) => (
              <option key={k} value={k}>{KIND_LABEL[k]}</option>
            ))}
          </select>
          <input className="sr-input" style={{ flex: '3 1 240px' }} placeholder="文字" value={text} disabled={busy} onChange={(e) => setText(e.target.value)} />
          {kind === 'surprise' && (
            <input className="sr-input" style={{ flex: '1 1 120px' }} placeholder="盒子外觀文字" value={label} disabled={busy} onChange={(e) => setLabel(e.target.value)} />
          )}
          <input className="sr-input" style={{ flex: '0 0 70px' }} type="number" step="0.1" min="0.1" placeholder="權重" value={weight} disabled={busy} onChange={(e) => setWeight(e.target.value)} />
          <button type="button" className="sr-button" disabled={busy || !text.trim()} onClick={() => void add()}>
            新增
          </button>
        </div>
        {msg && (
          <p className="sr-muted" style={{ marginTop: 'var(--sr-space-2)', marginBottom: 0, ...(error ? { color: 'var(--sr-danger)' } : {}) }}>
            {msg}
          </p>
        )}
        <p className="sr-muted" style={{ marginTop: 'var(--sr-space-2)', marginBottom: 0, fontSize: 'var(--sr-text-xs)' }}>
          新增的文字一樣會過內容安全過濾。
        </p>
      </section>

      {[...byKind.entries()].map(([k, list]) => (
        <section key={k} className="sr-card" style={{ marginTop: 'var(--sr-space-4)' }}>
          <h2 className="sr-section-title">
            {KIND_LABEL[k] ?? k} <span className="sr-muted" style={{ fontWeight: 400 }}>（{list.length}）</span>
          </h2>
          <ul className="sr-stack" style={{ margin: 0, padding: 0, listStyle: 'none', gap: 'var(--sr-space-2)' }}>
            {list.map((r) => (
              <ContentItemRow key={r.content_id} row={r} onPatch={patch} onRemove={remove} />
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}

function ContentItemRow({
  row,
  onPatch,
  onRemove,
}: {
  row: ContentRow
  onPatch: (row: ContentRow, p: { enabled?: boolean; text?: string; weight?: number }) => void
  onRemove: (row: ContentRow) => void
}) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(row.text)
  const [weight, setWeight] = useState(String(row.weight))
  const isChain = row.kind === 'chain'

  return (
    <li style={{ opacity: row.enabled ? 1 : 0.5, borderTop: '1px solid var(--sr-border)', paddingTop: 'var(--sr-space-2)' }}>
      {editing ? (
        <div className="sr-row" style={{ gap: 'var(--sr-space-2)', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <input className="sr-input" style={{ flex: '3 1 240px' }} value={text} onChange={(e) => setText(e.target.value)} />
          <input className="sr-input" style={{ flex: '0 0 70px' }} type="number" step="0.1" min="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
          <button
            type="button"
            className="sr-button"
            style={{ padding: '2px 10px', fontSize: 'var(--sr-text-xs)' }}
            onClick={() => {
              onPatch(row, { text, weight: Number(weight) || 1 })
              setEditing(false)
            }}
          >
            存
          </button>
          <button type="button" className="sr-button sr-button-secondary" style={{ padding: '2px 10px', fontSize: 'var(--sr-text-xs)' }} onClick={() => { setText(row.text); setWeight(String(row.weight)); setEditing(false) }}>
            取消
          </button>
        </div>
      ) : (
        <div className="sr-row" style={{ gap: 'var(--sr-space-2)', flexWrap: 'wrap', alignItems: 'baseline' }}>
          <span style={{ flex: 1, fontSize: 'var(--sr-text-sm)', minWidth: 180 }}>{row.text}</span>
          <span className="sr-muted" style={{ fontSize: 'var(--sr-text-xs)' }}>
            權重 {row.weight}
            {row.rarity ? `·${row.rarity}` : ''}
            {row.tags.length ? `·${row.tags.join('/')}` : ''}
          </span>
          <button type="button" className="sr-button sr-button-secondary" style={{ padding: '1px 8px', fontSize: 'var(--sr-text-xs)' }} onClick={() => onPatch(row, { enabled: !row.enabled })}>
            {row.enabled ? '啟用中' : '已停用'}
          </button>
          {!isChain && (
            <>
              <button type="button" className="sr-button sr-button-secondary" style={{ padding: '1px 8px', fontSize: 'var(--sr-text-xs)' }} onClick={() => setEditing(true)}>
                編輯
              </button>
              <button type="button" className="sr-button sr-button-secondary" style={{ padding: '1px 8px', fontSize: 'var(--sr-text-xs)', color: 'var(--sr-danger)' }} onClick={() => onRemove(row)}>
                刪除
              </button>
            </>
          )}
        </div>
      )}
    </li>
  )
}
