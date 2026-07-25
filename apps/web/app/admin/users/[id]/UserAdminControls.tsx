'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Role = 'owner' | 'admin' | 'member'

/**
 * 單一使用者的角色／特權編輯（CRM 詳情頁用）。只有 owner 能改、不能改自己角色。
 * 共用 /api/admin/users PATCH。
 */
export function UserAdminControls({
  userId,
  initialRole,
  initialPrivileged,
  isOwner,
  isSelf,
}: {
  userId: string
  initialRole: Role
  initialPrivileged: boolean
  isOwner: boolean
  isSelf: boolean
}) {
  const router = useRouter()
  const [role, setRole] = useState<Role>(initialRole)
  const [privileged, setPrivileged] = useState(initialPrivileged)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState(false)

  async function patch(patch: { siteRole?: Role; privileged?: boolean }) {
    const prevRole = role
    const prevPriv = privileged
    if (patch.siteRole) setRole(patch.siteRole)
    if (patch.privileged !== undefined) setPrivileged(patch.privileged)
    setBusy(true)
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
      setRole(prevRole)
      setPrivileged(prevPriv)
      setError(true)
      setMsg(e instanceof Error ? e.message : '更新失敗')
    } finally {
      setBusy(false)
    }
  }

  if (!isOwner) {
    return (
      <p className="sr-muted" style={{ margin: 0, fontSize: 'var(--sr-text-sm)' }}>
        角色 {role}·特權 {privileged ? '有' : '無'}（僅 owner 可調）
      </p>
    )
  }

  return (
    <div className="sr-row" style={{ alignItems: 'center', gap: 'var(--sr-space-3)', flexWrap: 'wrap' }}>
      <label className="sr-row" style={{ alignItems: 'center', gap: 'var(--sr-space-1)' }}>
        <span className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)' }}>角色</span>
        <select
          className="sr-input"
          style={{ padding: '2px 6px' }}
          value={role}
          disabled={busy || isSelf}
          onChange={(e) => void patch({ siteRole: e.target.value as Role })}
        >
          <option value="owner">擁有者</option>
          <option value="admin">管理員</option>
          <option value="member">成員</option>
        </select>
      </label>
      <label className="sr-row" style={{ alignItems: 'center', gap: 'var(--sr-space-1)' }}>
        <input type="checkbox" checked={privileged} disabled={busy} onChange={(e) => void patch({ privileged: e.target.checked })} />
        <span className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)' }}>特權</span>
      </label>
      {isSelf && <span className="sr-muted" style={{ fontSize: 'var(--sr-text-xs)' }}>（不能改自己角色）</span>}
      {msg && (
        <span className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)', ...(error ? { color: 'var(--sr-danger)' } : {}) }}>
          {msg}
        </span>
      )}
    </div>
  )
}
