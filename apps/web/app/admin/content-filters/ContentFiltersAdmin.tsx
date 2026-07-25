'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Pattern = { id: string; pattern: string; description: string | null; enabled: boolean }

/**
 * 附加安全字樣的管理（新增／啟用停用／刪除）。
 * 底線 FORBIDDEN_PATTERNS 不在這裡（不可停用），另在頁面上方唯讀列出。
 */
export function ContentFiltersAdmin({ initial }: { initial: Pattern[] }) {
  const router = useRouter()
  const [rows, setRows] = useState<Pattern[]>(initial)
  const [pattern, setPattern] = useState('')
  const [desc, setDesc] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState(false)

  function preview(): string | null {
    if (!pattern) return null
    try {
      new RegExp(pattern)
      return null
    } catch {
      return '不是有效的正則表示式'
    }
  }
  const patternError = preview()

  async function add() {
    if (patternError || !pattern) return
    setBusy(true)
    setMsg(null)
    setError(false)
    try {
      const res = await fetch('/api/admin/content-filters', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pattern, description: desc || undefined }),
      })
      const json: { data?: Pattern; error?: { message?: string } } = await res.json()
      if (!res.ok || !json.data) throw new Error(json.error?.message ?? '新增失敗')
      setRows((r) => [...r, json.data!])
      setPattern('')
      setDesc('')
      setMsg('已新增。')
      router.refresh()
    } catch (e) {
      setError(true)
      setMsg(e instanceof Error ? e.message : '新增失敗')
    } finally {
      setBusy(false)
    }
  }

  async function toggle(row: Pattern) {
    const next = !row.enabled
    setRows((r) => r.map((x) => (x.id === row.id ? { ...x, enabled: next } : x)))
    try {
      const res = await fetch('/api/admin/content-filters', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: row.id, enabled: next }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setRows((r) => r.map((x) => (x.id === row.id ? { ...x, enabled: !next } : x)))
    }
  }

  async function remove(row: Pattern) {
    setRows((r) => r.filter((x) => x.id !== row.id))
    try {
      const res = await fetch(`/api/admin/content-filters?id=${encodeURIComponent(row.id)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
    } catch {
      setRows((r) => [...r, row])
    }
  }

  return (
    <section className="sr-card" style={{ padding: 'var(--sr-space-4)', marginTop: 'var(--sr-space-4)' }}>
      <h2 className="sr-section-title">附加字樣（{rows.length}）</h2>
      <p className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)' }}>
        這些**附加**在底線之上，只會讓過濾更嚴。輸入正則（例如 <code>賭博|投注</code>）。
      </p>

      <div className="sr-row" style={{ gap: 'var(--sr-space-2)', flexWrap: 'wrap', alignItems: 'flex-start', marginTop: 'var(--sr-space-2)' }}>
        <input
          className="sr-input"
          placeholder="正則字樣"
          value={pattern}
          disabled={busy}
          onChange={(e) => setPattern(e.target.value)}
          style={{ flex: '2 1 200px', fontFamily: 'monospace' }}
        />
        <input
          className="sr-input"
          placeholder="說明（選填）"
          value={desc}
          disabled={busy}
          onChange={(e) => setDesc(e.target.value)}
          style={{ flex: '1 1 140px' }}
        />
        <button type="button" className="sr-button" disabled={busy || !pattern || Boolean(patternError)} onClick={() => void add()}>
          新增
        </button>
      </div>
      {(patternError || msg) && (
        <p className="sr-muted" style={{ marginTop: 'var(--sr-space-2)', ...(patternError || error ? { color: 'var(--sr-danger)' } : {}) }}>
          {patternError ?? msg}
        </p>
      )}

      {rows.length > 0 && (
        <ul className="sr-stack" style={{ listStyle: 'none', margin: 'var(--sr-space-3) 0 0', padding: 0, gap: 'var(--sr-space-2)' }}>
          {rows.map((r) => (
            <li key={r.id} className="sr-row" style={{ alignItems: 'center', gap: 'var(--sr-space-2)', opacity: r.enabled ? 1 : 0.5 }}>
              <code style={{ flex: 1, fontSize: 'var(--sr-text-sm)', wordBreak: 'break-all' }}>{r.pattern}</code>
              {r.description && <span className="sr-muted" style={{ fontSize: 'var(--sr-text-xs)' }}>{r.description}</span>}
              <button type="button" className="sr-button sr-button-secondary" style={{ padding: '1px 8px', fontSize: 'var(--sr-text-xs)' }} onClick={() => void toggle(r)}>
                {r.enabled ? '啟用中' : '已停用'}
              </button>
              <button type="button" className="sr-button sr-button-secondary" style={{ padding: '1px 8px', fontSize: 'var(--sr-text-xs)', color: 'var(--sr-danger)' }} onClick={() => void remove(r)}>
                刪除
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
