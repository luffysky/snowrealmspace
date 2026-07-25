'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Candidate = { model: string; role: 'primary' | 'fallback' | 'escalate' }

const ROLE_LABEL: Record<Candidate['role'], string> = {
  primary: '主',
  fallback: '備援',
  escalate: '升級',
}

/**
 * 單一用途的候選鏈編輯。可調順序（▲▼）、啟用/停用覆寫、重設回內建預設。
 * 不改 model 字串本身（避免打錯型號）；只重排既有候選與開關。
 */
export function CandidateChainEditor({
  usageKey,
  initialCandidates,
  isOverride,
  initialEnabled,
}: {
  usageKey: string
  initialCandidates: Candidate[]
  isOverride: boolean
  initialEnabled: boolean
}) {
  const router = useRouter()
  const [list, setList] = useState<Candidate[]>(initialCandidates)
  const [enabled, setEnabled] = useState(initialEnabled)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [dirty, setDirty] = useState(false)

  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= list.length) return
    const next = [...list]
    ;[next[i], next[j]] = [next[j]!, next[i]!]
    setList(next)
    setDirty(true)
  }

  async function save() {
    setBusy(true)
    setMsg(null)
    setError(false)
    try {
      const res = await fetch('/api/admin/ai-candidates', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ usageKey, candidates: list, enabled }),
      })
      const json: { error?: { message?: string } } = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? '更新失敗')
      setMsg('已儲存覆寫。')
      setDirty(false)
      router.refresh()
    } catch (e) {
      setError(true)
      setMsg(e instanceof Error ? e.message : '更新失敗')
    } finally {
      setBusy(false)
    }
  }

  async function reset() {
    setBusy(true)
    setMsg(null)
    setError(false)
    try {
      const res = await fetch(`/api/admin/ai-candidates?usageKey=${encodeURIComponent(usageKey)}`, { method: 'DELETE' })
      const json: { error?: { message?: string } } = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? '重設失敗')
      setMsg('已重設回預設。')
      setDirty(false)
      router.refresh()
    } catch (e) {
      setError(true)
      setMsg(e instanceof Error ? e.message : '重設失敗')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="sr-card" style={{ padding: 'var(--sr-space-4)' }}>
      <div className="sr-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--sr-space-2)' }}>
        <strong>{usageKey}</strong>
        <span className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)' }}>
          {isOverride ? '已覆寫預設' : '使用內建預設'}
        </span>
      </div>

      <ol style={{ margin: 'var(--sr-space-2) 0 0', paddingLeft: 0, listStyle: 'none' }}>
        {list.map((c, i) => (
          <li
            key={`${c.model}-${i}`}
            className="sr-row"
            style={{ alignItems: 'center', gap: 'var(--sr-space-2)', padding: '2px 0' }}
          >
            <span className="sr-badge" style={{ minWidth: 42, fontSize: 'var(--sr-text-xs)' }}>
              {ROLE_LABEL[c.role]}
            </span>
            <code style={{ flex: 1, fontSize: 'var(--sr-text-sm)' }}>{c.model}</code>
            <button
              type="button"
              className="sr-button sr-button-secondary"
              style={{ padding: '2px 8px' }}
              aria-label="上移"
              disabled={busy || i === 0}
              onClick={() => move(i, -1)}
            >
              ▲
            </button>
            <button
              type="button"
              className="sr-button sr-button-secondary"
              style={{ padding: '2px 8px' }}
              aria-label="下移"
              disabled={busy || i === list.length - 1}
              onClick={() => move(i, 1)}
            >
              ▼
            </button>
          </li>
        ))}
      </ol>

      <div className="sr-row" style={{ alignItems: 'center', gap: 'var(--sr-space-3)', marginTop: 'var(--sr-space-3)', flexWrap: 'wrap' }}>
        <label className="sr-row" style={{ alignItems: 'center', gap: 'var(--sr-space-1)', fontSize: 'var(--sr-text-sm)' }}>
          <input
            type="checkbox"
            checked={enabled}
            disabled={busy}
            onChange={(e) => {
              setEnabled(e.target.checked)
              setDirty(true)
            }}
          />
          啟用覆寫
        </label>
        <button type="button" className="sr-button" disabled={busy || !dirty} onClick={() => void save()}>
          {busy ? '處理中…' : '儲存覆寫'}
        </button>
        {isOverride && (
          <button type="button" className="sr-button sr-button-secondary" disabled={busy} onClick={() => void reset()}>
            重設回預設
          </button>
        )}
        {msg && (
          <span className="sr-muted" style={error ? { color: 'var(--sr-danger)' } : undefined}>
            {msg}
          </span>
        )}
      </div>
    </section>
  )
}
