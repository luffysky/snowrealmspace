'use client'

import { useState } from 'react'

/** 顯示一個 ID（uuid）並可一鍵複製。 */
export function CopyId({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // 剪貼簿被拒（少見）：使用者仍可手動選取 code
    }
  }

  return (
    <div className="sr-row" style={{ alignItems: 'center', gap: 'var(--sr-space-2)', flexWrap: 'wrap' }}>
      <span className="sr-muted" style={{ minWidth: 72, fontSize: 'var(--sr-text-sm)' }}>
        {label}
      </span>
      <code style={{ fontSize: 'var(--sr-text-sm)', wordBreak: 'break-all', flex: 1 }}>{value}</code>
      <button
        type="button"
        className="sr-button sr-button-secondary"
        style={{ padding: '1px 8px', fontSize: 'var(--sr-text-xs)' }}
        onClick={() => void copy()}
      >
        {copied ? '已複製' : '複製'}
      </button>
    </div>
  )
}
