'use client'

import { useEffect, useState } from 'react'
import type { WidgetProps } from '../types'

/**
 * 每日卡片。顯示今天的問候、語錄與創作提示。
 *
 * 內容來自 content_items 池，由 /api/daily/today 生成並回傳
 * （09-content-pool.md）。同一天內穩定 —— 選取是決定性的，
 * 重整頁面不會換句子。
 */

type Today = {
  greeting: string | null
  quote: { id: string; text: string } | null
  prompt: { id: string; text: string; estimatedMinutes: number | null } | null
}

export default function DailyCardWidget({ config }: WidgetProps) {
  const compact = (config as { compact?: boolean } | null)?.compact ?? false

  const [today, setToday] = useState<Today | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await fetch('/api/daily/today')
      if (cancelled) return
      if (!res.ok) {
        setError(true)
        return
      }
      const body = (await res.json()) as { data: Today }
      if (!cancelled) setToday(body.data)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return (
      <div className="sr-card sr-daily-card">
        <p className="sr-muted" style={{ margin: 0 }}>
          今天的內容暫時讀不到，稍後再看看。
        </p>
      </div>
    )
  }

  if (!today) {
    return (
      <div className="sr-card sr-daily-card" aria-busy="true">
        <p className="sr-muted" style={{ margin: 0 }}>
          載入今天的內容…
        </p>
      </div>
    )
  }

  // 池還沒 seed 時三者皆空 —— 誠實說明，不留空殼（Q6）
  if (!today.greeting && !today.quote && !today.prompt) {
    return (
      <div className="sr-card sr-daily-card">
        <p className="sr-muted" style={{ margin: 0 }}>
          還沒有今天的內容。
        </p>
      </div>
    )
  }

  return (
    <div className="sr-card sr-daily-card">
      {today.greeting && <p className="sr-daily-greeting">{today.greeting}</p>}

      {today.quote && (
        <blockquote className="sr-daily-quote">
          {today.quote.text}
        </blockquote>
      )}

      {today.prompt && !compact && (
        <div className="sr-daily-prompt">
          <span className="sr-label" style={{ marginBottom: 4 }}>
            今天試試看
          </span>
          <p style={{ margin: 0 }}>{today.prompt.text}</p>
          {today.prompt.estimatedMinutes != null && (
            <span className="sr-muted sr-daily-minutes">
              約 {today.prompt.estimatedMinutes} 分鐘
            </span>
          )}
        </div>
      )}
    </div>
  )
}
