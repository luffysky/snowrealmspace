'use client'

import { useState } from 'react'

export type ChainRow = {
  content_id: string
  label: string | null
  text: string
  chain_index: number | null
  available_from: string | null
  enabled: boolean
}

const AVAIL: { value: string; label: string }[] = [
  { value: 'immediately', label: '立即（一進來就有）' },
  { value: 'after_first_theme', label: '換過一次主題後' },
  { value: 'after_first_upload', label: '上傳第一個作品後' },
  { value: 'after_7_days', label: '用滿七天後' },
  { value: 'after_1_year', label: '滿一年後' },
]
const availLabel = (v: string | null) => AVAIL.find((a) => a.value === v)?.label ?? '立即'

function sortRows(rows: ChainRow[]): ChainRow[] {
  return [...rows].sort((a, b) => (a.chain_index ?? 0) - (b.chain_index ?? 0))
}

export function ChainAdmin({ initial }: { initial: ChainRow[] }) {
  const [rows, setRows] = useState<ChainRow[]>(sortRows(initial))
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  // 新增表單
  const [nTitle, setNTitle] = useState('')
  const [nText, setNText] = useState('')
  const [nAvail, setNAvail] = useState('immediately')

  function say(kind: 'ok' | 'error', text: string) {
    setMsg({ kind, text })
  }

  async function create() {
    if (!nTitle.trim() || !nText.trim()) return
    setBusy(true)
    setMsg(null)
    try {
      const chainIndex = rows.reduce((m, r) => Math.max(m, r.chain_index ?? 0), -1) + 1
      const res = await fetch('/api/admin/chain', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: nTitle.trim(), text: nText.trim(), availableFrom: nAvail, chainIndex }),
      })
      const j = (await res.json()) as { data?: ChainRow; error?: { message?: string } }
      if (!res.ok || !j.data) throw new Error(j.error?.message ?? '新增失敗')
      setRows((r) => sortRows([...r, j.data!]))
      setNTitle('')
      setNText('')
      setNAvail('immediately')
      say('ok', '已新增。')
    } catch (e) {
      say('error', e instanceof Error ? e.message : '新增失敗')
    } finally {
      setBusy(false)
    }
  }

  async function patch(row: ChainRow, p: Partial<Pick<ChainRow, 'label' | 'text' | 'available_from' | 'chain_index' | 'enabled'>>) {
    const before = rows
    setRows((rs) => sortRows(rs.map((r) => (r.content_id === row.content_id ? { ...r, ...p } : r))))
    try {
      const body: Record<string, unknown> = { contentId: row.content_id }
      if (p.label !== undefined) body.title = p.label
      if (p.text !== undefined) body.text = p.text
      if (p.available_from !== undefined) body.availableFrom = p.available_from
      if (p.chain_index !== undefined) body.chainIndex = p.chain_index
      if (p.enabled !== undefined) body.enabled = p.enabled
      const res = await fetch('/api/admin/chain', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = (await res.json()) as { error?: { message?: string } }
        throw new Error(j.error?.message ?? '更新失敗')
      }
    } catch (e) {
      setRows(before)
      say('error', e instanceof Error ? e.message : '更新失敗')
    }
  }

  async function remove(row: ChainRow) {
    const before = rows
    setRows((rs) => rs.filter((r) => r.content_id !== row.content_id))
    try {
      const res = await fetch(`/api/admin/chain?contentId=${encodeURIComponent(row.content_id)}`, { method: 'DELETE' })
      if (!res.ok) {
        const j = (await res.json()) as { error?: { message?: string } }
        throw new Error(j.error?.message ?? '刪除失敗')
      }
    } catch (e) {
      setRows(before)
      say('error', e instanceof Error ? e.message : '刪除失敗')
    }
  }

  /** 與相鄰的里程碑交換順序（各自 PATCH 一次 chain_index）。 */
  async function move(idx: number, dir: -1 | 1) {
    const a = rows[idx]
    const b = rows[idx + dir]
    if (!a || !b) return
    const ai = a.chain_index ?? 0
    const bi = b.chain_index ?? 0
    await Promise.all([patch(a, { chain_index: bi }), patch(b, { chain_index: ai })])
  }

  return (
    <>
      <section className="sr-card" style={{ marginTop: 'var(--sr-space-4)' }}>
        <h2 className="sr-section-title">新增里程碑</h2>
        <div className="sr-field">
          <input className="sr-input" placeholder="標題（例如：第七天）" value={nTitle} disabled={busy} maxLength={40} onChange={(e) => setNTitle(e.target.value)} />
        </div>
        <div className="sr-field" style={{ marginTop: 'var(--sr-space-2)' }}>
          <textarea className="sr-input" placeholder="內文（可用 {name} 代入名字）" value={nText} disabled={busy} rows={4} onChange={(e) => setNText(e.target.value)} />
        </div>
        <div className="sr-row" style={{ gap: 'var(--sr-space-2)', marginTop: 'var(--sr-space-2)', flexWrap: 'wrap' }}>
          <select className="sr-input" style={{ flex: '1 1 200px' }} value={nAvail} disabled={busy} onChange={(e) => setNAvail(e.target.value)}>
            {AVAIL.map((a) => (
              <option key={a.value} value={a.value}>解鎖：{a.label}</option>
            ))}
          </select>
          <button type="button" className="sr-button" disabled={busy || !nTitle.trim() || !nText.trim()} onClick={() => void create()}>
            新增
          </button>
        </div>
        {msg && (
          <p className="sr-muted" style={{ marginTop: 'var(--sr-space-2)', marginBottom: 0, ...(msg.kind === 'error' ? { color: 'var(--sr-danger)' } : {}) }}>
            {msg.text}
          </p>
        )}
      </section>

      {rows.map((row, i) => (
        <ChainRowEditor
          key={row.content_id}
          row={row}
          canUp={i > 0}
          canDown={i < rows.length - 1}
          availLabel={availLabel(row.available_from)}
          onPatch={patch}
          onRemove={remove}
          onMove={(dir) => void move(i, dir)}
        />
      ))}
    </>
  )
}

function ChainRowEditor({
  row,
  canUp,
  canDown,
  availLabel,
  onPatch,
  onRemove,
  onMove,
}: {
  row: ChainRow
  canUp: boolean
  canDown: boolean
  availLabel: string
  onPatch: (row: ChainRow, p: Partial<Pick<ChainRow, 'label' | 'text' | 'available_from' | 'chain_index' | 'enabled'>>) => void
  onRemove: (row: ChainRow) => void
  onMove: (dir: -1 | 1) => void
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(row.label ?? '')
  const [text, setText] = useState(row.text)
  const [avail, setAvail] = useState(row.available_from ?? 'immediately')

  return (
    <section className="sr-card" style={{ marginTop: 'var(--sr-space-3)', opacity: row.enabled ? 1 : 0.55 }}>
      <div className="sr-row" style={{ gap: 'var(--sr-space-2)', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <strong>
          #{(row.chain_index ?? 0) + 1} · {row.label || '（無標題）'}
        </strong>
        <div className="sr-row" style={{ gap: 4 }}>
          <button type="button" className="sr-button sr-button-secondary" style={{ padding: '1px 8px' }} disabled={!canUp} onClick={() => onMove(-1)} aria-label="上移">↑</button>
          <button type="button" className="sr-button sr-button-secondary" style={{ padding: '1px 8px' }} disabled={!canDown} onClick={() => onMove(1)} aria-label="下移">↓</button>
        </div>
      </div>
      <p className="sr-muted" style={{ margin: 'var(--sr-space-1) 0 0', fontSize: 'var(--sr-text-xs)' }}>解鎖：{availLabel}</p>

      {editing ? (
        <div style={{ marginTop: 'var(--sr-space-2)' }}>
          <input className="sr-input" value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} placeholder="標題" />
          <textarea className="sr-input" style={{ marginTop: 'var(--sr-space-2)' }} rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="內文（可用 {name}）" />
          <select className="sr-input" style={{ marginTop: 'var(--sr-space-2)' }} value={avail} onChange={(e) => setAvail(e.target.value)}>
            {AVAIL.map((a) => (
              <option key={a.value} value={a.value}>解鎖：{a.label}</option>
            ))}
          </select>
          <div className="sr-row" style={{ gap: 'var(--sr-space-2)', marginTop: 'var(--sr-space-2)' }}>
            <button
              type="button"
              className="sr-button"
              onClick={() => {
                onPatch(row, { label: title.trim(), text: text.trim(), available_from: avail })
                setEditing(false)
              }}
            >
              存
            </button>
            <button type="button" className="sr-button sr-button-secondary" onClick={() => { setTitle(row.label ?? ''); setText(row.text); setAvail(row.available_from ?? 'immediately'); setEditing(false) }}>
              取消
            </button>
          </div>
        </div>
      ) : (
        <>
          <p style={{ whiteSpace: 'pre-wrap', margin: 'var(--sr-space-2) 0 0', fontSize: 'var(--sr-text-sm)', color: 'var(--sr-text-secondary)' }}>
            {row.text.length > 160 ? row.text.slice(0, 160) + '…' : row.text}
          </p>
          <div className="sr-row" style={{ gap: 'var(--sr-space-2)', marginTop: 'var(--sr-space-2)', flexWrap: 'wrap' }}>
            <button type="button" className="sr-button sr-button-secondary" style={{ padding: '1px 10px', fontSize: 'var(--sr-text-xs)' }} onClick={() => onPatch(row, { enabled: !row.enabled })}>
              {row.enabled ? '啟用中' : '已停用'}
            </button>
            <button type="button" className="sr-button sr-button-secondary" style={{ padding: '1px 10px', fontSize: 'var(--sr-text-xs)' }} onClick={() => setEditing(true)}>
              編輯
            </button>
            <button type="button" className="sr-button sr-button-secondary" style={{ padding: '1px 10px', fontSize: 'var(--sr-text-xs)', color: 'var(--sr-danger)' }} onClick={() => onRemove(row)}>
              刪除
            </button>
          </div>
        </>
      )}
    </section>
  )
}
