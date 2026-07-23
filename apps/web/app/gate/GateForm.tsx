'use client'

import { useState } from 'react'

export function GateForm({ next }: { next: string }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/gate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
        setError(body?.error?.message ?? '密碼不對。')
        return
      }
      // 通過 → 整頁導向（讓 middleware 用新 cookie 重新判斷）
      window.location.href = next || '/'
    } catch {
      setError('連線出了點問題，再試一次。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="sr-stack" style={{ gap: 'var(--sr-space-3)' }}>
      <label className="sr-visually-hidden" htmlFor="gate-password">
        密碼
      </label>
      <input
        id="gate-password"
        className="sr-input"
        type="password"
        autoComplete="off"
        autoFocus
        placeholder="輸入密碼"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && (
        <p className="sr-message sr-message-error" role="alert" style={{ textAlign: 'left' }}>
          ✕ {error}
        </p>
      )}
      <button type="submit" className="sr-button" disabled={busy || password.length === 0}>
        {busy ? '確認中…' : '進入'}
      </button>
    </form>
  )
}
