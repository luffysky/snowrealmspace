'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * 回應快取的清除動作（站台管理員）。
 * 「全部清空」用二次點擊確認，不用原生 confirm dialog。
 */
export function CacheAdminActions() {
  const router = useRouter()
  const [busy, setBusy] = useState<'expired' | 'all' | null>(null)
  const [confirmAll, setConfirmAll] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState(false)

  async function clear(mode: 'expired' | 'all') {
    setBusy(mode)
    setMsg(null)
    setError(false)
    try {
      const res = await fetch(`/api/admin/ai-cache?mode=${mode}`, { method: 'DELETE' })
      const json: { data?: { removed?: number }; error?: { message?: string } } = await res.json()
      if (!res.ok) throw new Error(json.error?.message ?? '清除失敗')
      setMsg(`已清除 ${json.data?.removed ?? 0} 筆快取。`)
      setConfirmAll(false)
      router.refresh()
    } catch (e) {
      setError(true)
      setMsg(e instanceof Error ? e.message : '清除失敗')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--sr-space-3)', marginTop: 'var(--sr-space-4)' }}>
      <button
        type="button"
        className="sr-button sr-button-secondary"
        disabled={busy !== null}
        onClick={() => void clear('expired')}
      >
        {busy === 'expired' ? '清除中…' : '清除過期'}
      </button>

      {confirmAll ? (
        <>
          <button
            type="button"
            className="sr-button"
            style={{ background: 'var(--sr-danger)' }}
            disabled={busy !== null}
            onClick={() => void clear('all')}
          >
            {busy === 'all' ? '清除中…' : '確定全部清空？'}
          </button>
          <button type="button" className="sr-button sr-button-secondary" disabled={busy !== null} onClick={() => setConfirmAll(false)}>
            取消
          </button>
        </>
      ) : (
        <button type="button" className="sr-button sr-button-secondary" disabled={busy !== null} onClick={() => setConfirmAll(true)}>
          全部清空
        </button>
      )}

      {msg && (
        <span className="sr-muted" style={error ? { color: 'var(--sr-danger)' } : undefined}>
          {msg}
        </span>
      )}
    </div>
  )
}
