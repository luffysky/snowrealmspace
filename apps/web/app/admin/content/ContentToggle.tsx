'use client'

import { useState } from 'react'

/**
 * 內容池單則的啟用/停用（樂觀更新 + 失敗回滾）。
 * 停用的文案不會再被主動訊息／每日內容抽中。
 */
export function ContentToggle({ contentId, initialEnabled }: { contentId: string; initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [busy, setBusy] = useState(false)

  async function toggle() {
    const next = !enabled
    setEnabled(next)
    setBusy(true)
    try {
      const res = await fetch('/api/admin/content', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contentId, enabled: next }),
      })
      if (!res.ok) throw new Error('failed')
    } catch {
      setEnabled(!next) // 回滾
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      className="sr-button sr-button-secondary"
      style={{ padding: '1px 8px', fontSize: 'var(--sr-text-xs)', marginLeft: 'var(--sr-space-2)', ...(enabled ? {} : { color: 'var(--sr-danger)' }) }}
      disabled={busy}
      aria-pressed={enabled}
      onClick={() => void toggle()}
    >
      {enabled ? '啟用中' : '已停用'}
    </button>
  )
}
