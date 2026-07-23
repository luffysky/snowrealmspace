'use client'

import { useEffect } from 'react'

/**
 * Q9：錯誤狀態必須有 UI。
 * 不顯示原始錯誤訊息給使用者 —— 那可能洩漏內部結構。
 * digest 讓使用者回報問題時我們能對上伺服器 log。
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app] 未預期的錯誤', error)
  }, [error])

  return (
    <main className="sr-center">
      <div className="sr-card" style={{ maxWidth: 460, width: '100%' }}>
        <h1 style={{ fontSize: 'var(--sr-text-h2)', marginBottom: 'var(--sr-space-3)' }}>
          出了點問題
        </h1>
        <p className="sr-muted" style={{ marginTop: 0 }}>
          這不是你的操作造成的。可以再試一次。
        </p>
        {error.digest && (
          <p className="sr-muted" style={{ fontFamily: 'var(--sr-font-mono)' }}>
            代碼：{error.digest}
          </p>
        )}
        <button className="sr-button" type="button" onClick={reset}>
          重試
        </button>
      </div>
    </main>
  )
}
