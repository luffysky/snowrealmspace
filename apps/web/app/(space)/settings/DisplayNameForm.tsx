'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * 顯示名字。全站顯示「你」的地方（品牌列、AI 對話、頭貼旁）都用它。
 * 存進 profiles.display_name（走 /api/profile）；存完 router.refresh 讓 SSR 各處同步。
 */
export function DisplayNameForm({ initial }: { initial: string }) {
  const router = useRouter()
  const [value, setValue] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const trimmed = value.trim()
  const dirty = trimmed !== initial.trim() && trimmed.length > 0

  async function save() {
    if (!dirty) return
    setBusy(true)
    setNotice(null)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ displayName: trimmed }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
        throw new Error(j?.error?.message ?? '儲存失敗')
      }
      setNotice({ kind: 'ok', text: '已儲存。' })
      router.refresh()
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof Error ? e.message : '儲存失敗' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sr-field">
      <label className="sr-label" htmlFor="display-name">
        顯示名字
      </label>
      <div className="sr-row" style={{ gap: 'var(--sr-space-2)', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <input
          id="display-name"
          className="sr-input"
          style={{ flex: '2 1 200px' }}
          value={value}
          maxLength={40}
          disabled={busy}
          placeholder="你想被怎麼稱呼"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void save()
            }
          }}
        />
        <button type="button" className="sr-button" disabled={busy || !dirty} onClick={() => void save()}>
          {busy ? '儲存中…' : '儲存'}
        </button>
      </div>
      {notice && (
        <p className="sr-muted" style={{ margin: 'var(--sr-space-2) 0 0', ...(notice.kind === 'error' ? { color: 'var(--sr-danger)' } : {}) }}>
          {notice.text}
        </p>
      )}
    </div>
  )
}
