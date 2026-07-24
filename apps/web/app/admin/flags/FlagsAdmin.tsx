'use client'

import { useState } from 'react'

type Flag = { key: string; description: string | null; enabled: boolean }

/**
 * 全域 feature flags 切換。樂觀更新 + 失敗回滾。
 */
export function FlagsAdmin({ initial }: { initial: Flag[] }) {
  const [flags, setFlags] = useState(initial)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function toggle(key: string, next: boolean) {
    setBusy(key)
    setError(null)
    setFlags((fs) => fs.map((f) => (f.key === key ? { ...f, enabled: next } : f)))
    try {
      const res = await fetch('/api/admin/feature-flags', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key, enabled: next }),
      })
      if (!res.ok) throw new Error(String(res.status))
    } catch {
      // 回滾
      setFlags((fs) => fs.map((f) => (f.key === key ? { ...f, enabled: !next } : f)))
      setError(`「${key}」更新失敗，已還原。`)
    } finally {
      setBusy(null)
    }
  }

  if (flags.length === 0) return <p className="sr-muted">尚無任何 feature flag。</p>

  return (
    <div className="sr-stack" style={{ gap: 'var(--sr-space-2)' }}>
      {error && (
        <p className="sr-message sr-message-error" role="alert">
          ✕ {error}
        </p>
      )}
      {flags.map((f) => (
        <label
          key={f.key}
          className="sr-card sr-row"
          style={{ justifyContent: 'space-between', alignItems: 'center', gap: 'var(--sr-space-3)', padding: 'var(--sr-space-3) var(--sr-space-4)', cursor: 'pointer' }}
        >
          <span>
            <code>{f.key}</code>
            {f.description && (
              <span className="sr-muted" style={{ display: 'block', fontSize: 'var(--sr-text-sm)' }}>
                {f.description}
              </span>
            )}
          </span>
          <input
            type="checkbox"
            checked={f.enabled}
            disabled={busy === f.key}
            onChange={(e) => toggle(f.key, e.target.checked)}
            style={{ width: 20, height: 20, flexShrink: 0 }}
          />
        </label>
      ))}
    </div>
  )
}
