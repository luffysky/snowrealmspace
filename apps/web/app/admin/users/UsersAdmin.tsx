'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Avatar } from '@/components/Avatar'

export type UserRow = {
  id: string
  email: string | null
  username: string | null
  displayName: string | null
  siteRole: 'owner' | 'admin' | 'member'
  privileged: boolean
  avatarUrl: string | null
}

const ROLE_LABEL: Record<UserRow['siteRole'], string> = {
  owner: '擁有者',
  admin: '管理員',
  member: '成員',
}

/**
 * 使用者角色／特權編輯。只有 owner 能改（isOwner）；不能改自己的角色。
 */
export function UsersAdmin({
  initial,
  isOwner,
  selfId,
  adminBase,
}: {
  initial: UserRow[]
  isOwner: boolean
  selfId: string
  adminBase: string
}) {
  const router = useRouter()
  const [rows, setRows] = useState<UserRow[]>(initial)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState(false)

  async function patch(userId: string, patch: { siteRole?: UserRow['siteRole']; privileged?: boolean }) {
    const before = rows
    setRows((rs) => rs.map((r) => (r.id === userId ? { ...r, ...patch } : r)))
    setBusyId(userId)
    setMsg(null)
    setError(false)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId, ...patch }),
      })
      const json: { error?: { message?: string } } = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? '更新失敗')
      setMsg('已更新。')
      router.refresh()
    } catch (e) {
      setRows(before) // 回滾
      setError(true)
      setMsg(e instanceof Error ? e.message : '更新失敗')
    } finally {
      setBusyId(null)
    }
  }

  const th = { padding: 'var(--sr-space-2)', textAlign: 'left' as const }
  const td = { padding: 'var(--sr-space-2)' }

  return (
    <section className="sr-card" style={{ marginTop: 'var(--sr-space-4)' }}>
      <div style={{ overflowX: 'auto' }}>
        <table className="sr-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--sr-text-sm)' }}>
          <thead>
            <tr>
              <th style={th}>使用者</th>
              <th style={th}>角色</th>
              <th style={th}>特權</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isSelf = r.id === selfId
              return (
                <tr key={r.id} style={{ borderTop: '1px solid var(--sr-border)' }}>
                  <td style={td}>
                    <div className="sr-row" style={{ gap: 'var(--sr-space-2)', alignItems: 'center' }}>
                      <Avatar src={r.avatarUrl} name={r.displayName || r.username || r.email || ''} size={32} />
                      <div>
                        <Link href={`${adminBase}/users/${r.id}`} className="sr-link">
                          {r.displayName || r.username || r.email || '（未命名）'}
                        </Link>
                        <span className="sr-muted" style={{ fontSize: 'var(--sr-text-xs)', display: 'block' }}>
                          {r.email ?? r.id.slice(0, 8) + '…'}
                          {isSelf ? '（你）' : ''}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td style={td}>
                    {isOwner && !isSelf ? (
                      <select
                        className="sr-input"
                        style={{ padding: '2px 6px' }}
                        value={r.siteRole}
                        disabled={busyId === r.id}
                        onChange={(e) => void patch(r.id, { siteRole: e.target.value as UserRow['siteRole'] })}
                      >
                        <option value="owner">擁有者</option>
                        <option value="admin">管理員</option>
                        <option value="member">成員</option>
                      </select>
                    ) : (
                      <span>{ROLE_LABEL[r.siteRole]}</span>
                    )}
                  </td>
                  <td style={td}>
                    {isOwner ? (
                      <label className="sr-row" style={{ alignItems: 'center', gap: 'var(--sr-space-1)' }}>
                        <input
                          type="checkbox"
                          checked={r.privileged}
                          disabled={busyId === r.id}
                          onChange={(e) => void patch(r.id, { privileged: e.target.checked })}
                        />
                        {r.privileged ? '有' : '無'}
                      </label>
                    ) : (
                      <span>{r.privileged ? '有' : '無'}</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {msg && (
        <p className="sr-muted" style={{ marginTop: 'var(--sr-space-3)', marginBottom: 0, ...(error ? { color: 'var(--sr-danger)' } : {}) }}>
          {msg}
        </p>
      )}
    </section>
  )
}
