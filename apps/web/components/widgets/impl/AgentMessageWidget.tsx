'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { WidgetProps } from '../types'

/**
 * Agent 訊息（Milestone E）。
 *
 * 進 Home 時打 /api/agent/message：顯示最新 N 則主動訊息
 * （產生由 worker cron 冪等處理，這裡只讀）。
 * 設定：showAvatar（頭像 ✦）、maxMessages（1–5 則）、allowQuickReply（回覆入口）。
 */

type Msg = { title: string; body: string }
type View =
  | { state: 'loading' }
  | { state: 'empty' }
  | { state: 'message'; messages: Msg[] }

export default function AgentMessageWidget({ config }: WidgetProps) {
  const cfg = config as
    | { showAvatar?: boolean; maxMessages?: number; allowQuickReply?: boolean }
    | null
  const showAvatar = cfg?.showAvatar ?? true
  const maxMessages = Math.min(5, Math.max(1, cfg?.maxMessages ?? 1))
  const allowQuickReply = cfg?.allowQuickReply ?? true

  const [view, setView] = useState<View>({ state: 'loading' })

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(`/api/agent/message?limit=${maxMessages}`)
        const json = (await res.json()) as {
          messages?: { title: string; body: string | null }[]
        }
        if (!alive) return
        const msgs = (json.messages ?? [])
          .filter((m): m is Msg => Boolean(m.body))
          .map((m) => ({ title: m.title, body: m.body }))
        setView(msgs.length ? { state: 'message', messages: msgs } : { state: 'empty' })
      } catch {
        if (alive) setView({ state: 'empty' })
      }
    })()
    return () => {
      alive = false
    }
  }, [maxMessages])

  if (view.state === 'loading') {
    return (
      <div className="sr-card sr-agent-msg" aria-busy="true">
        <span className="sr-muted">Agent…</span>
      </div>
    )
  }

  if (view.state === 'empty') {
    return (
      <div className="sr-card sr-agent-msg">
        {showAvatar && (
          <span className="sr-agent-avatar" aria-hidden="true">
            ✦
          </span>
        )}
        <p className="sr-muted" style={{ margin: 0 }}>
          今天還沒有想說的話。等你多用一點，我會慢慢認識你。
        </p>
      </div>
    )
  }

  return (
    <div className="sr-card sr-agent-msg">
      {showAvatar && (
        <span className="sr-agent-avatar" aria-hidden="true">
          ✦
        </span>
      )}
      <div style={{ minWidth: 0 }}>
        {view.messages.map((m, i) => (
          <div
            key={i}
            style={{ marginBottom: i < view.messages.length - 1 ? 'var(--sr-space-2)' : 0 }}
          >
            <p className="sr-agent-title">{m.title}</p>
            <p className="sr-agent-body">{m.body}</p>
          </div>
        ))}
        {allowQuickReply && (
          <Link href="/agent" className="sr-link" style={{ fontSize: 'var(--sr-text-sm)' }}>
            回覆 →
          </Link>
        )}
      </div>
    </div>
  )
}
