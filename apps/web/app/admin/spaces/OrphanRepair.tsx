'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type OrphanUser = { id: string; name: string }
type OrphanSpace = { id: string; name: string }

/**
 * 孤兒修復：沒有空間的使用者可佈建；缺附屬表的空間可補齊。
 * 走 PATCH /api/admin/provision（site-admin）。
 */
export function OrphanRepair({ users, spaces }: { users: OrphanUser[]; spaces: OrphanSpace[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState(false)

  async function call(key: string, body: Record<string, unknown>, okMsg: string) {
    setBusy(key)
    setMsg(null)
    setError(false)
    try {
      const res = await fetch('/api/admin/provision', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json: { error?: { message?: string } } = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? '失敗')
      setMsg(okMsg)
      router.refresh()
    } catch (e) {
      setError(true)
      setMsg(e instanceof Error ? e.message : '失敗')
    } finally {
      setBusy(null)
    }
  }

  if (users.length === 0 && spaces.length === 0) {
    return <p className="sr-muted" style={{ margin: 0 }}>沒有偵測到孤兒或缺件，一切正常。</p>
  }

  return (
    <div className="sr-stack" style={{ gap: 'var(--sr-space-3)' }}>
      {users.length > 0 && (
        <div>
          <h3 className="sr-section-title" style={{ fontSize: 'var(--sr-text-sm)' }}>沒有空間的使用者（{users.length}）</h3>
          <ul className="sr-stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 'var(--sr-space-2)' }}>
            {users.map((u) => (
              <li key={u.id} className="sr-row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 'var(--sr-space-2)' }}>
                <span style={{ fontSize: 'var(--sr-text-sm)' }}>
                  {u.name}
                  <span className="sr-muted" style={{ fontSize: 'var(--sr-text-xs)', marginLeft: 6 }}>{u.id.slice(0, 8)}…</span>
                </span>
                <button type="button" className="sr-button sr-button-secondary" style={{ padding: '2px 10px', fontSize: 'var(--sr-text-xs)' }} disabled={busy !== null} onClick={() => void call(`u-${u.id}`, { action: 'provision-user', userId: u.id }, '已佈建空間。')}>
                  {busy === `u-${u.id}` ? '佈建中…' : '佈建空間'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {spaces.length > 0 && (
        <div>
          <h3 className="sr-section-title" style={{ fontSize: 'var(--sr-text-sm)' }}>缺設定的空間（{spaces.length}）</h3>
          <ul className="sr-stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 'var(--sr-space-2)' }}>
            {spaces.map((s) => (
              <li key={s.id} className="sr-row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 'var(--sr-space-2)' }}>
                <span style={{ fontSize: 'var(--sr-text-sm)' }}>
                  {s.name}
                  <span className="sr-muted" style={{ fontSize: 'var(--sr-text-xs)', marginLeft: 6 }}>{s.id.slice(0, 8)}…</span>
                </span>
                <button type="button" className="sr-button sr-button-secondary" style={{ padding: '2px 10px', fontSize: 'var(--sr-text-xs)' }} disabled={busy !== null} onClick={() => void call(`s-${s.id}`, { action: 'repair-space', spaceId: s.id }, '已補齊。')}>
                  {busy === `s-${s.id}` ? '修復中…' : '修復'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {msg && (
        <p className="sr-muted" style={{ margin: 0, ...(error ? { color: 'var(--sr-danger)' } : {}) }}>{msg}</p>
      )}
    </div>
  )
}
