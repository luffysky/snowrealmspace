'use client'

import { useEffect, useState } from 'react'
import type { WidgetProps } from '../types'

/**
 * Agent 訊息（Milestone E）。
 *
 * 進 Home 時打 /api/agent/message：若條件允許就產生今天的主動訊息
 * （頻率上限、Quiet hours、安全過濾都在後端把關），並顯示最新一則。
 * 目前內容來自內容池與里程碑模板；Milestone D 有 Agent 後會換成真正的對話。
 */

type View =
  | { state: 'loading' }
  | { state: 'empty' }
  | { state: 'message'; title: string; body: string }

export default function AgentMessageWidget(_props: WidgetProps) {
  const [view, setView] = useState<View>({ state: 'loading' })

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch('/api/agent/message')
        const json = (await res.json()) as { data: { title: string; body: string | null } | null }
        if (!alive) return
        if (json.data?.body) {
          setView({ state: 'message', title: json.data.title, body: json.data.body })
        } else {
          setView({ state: 'empty' })
        }
      } catch {
        if (alive) setView({ state: 'empty' })
      }
    })()
    return () => {
      alive = false
    }
  }, [])

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
        <span className="sr-agent-avatar" aria-hidden="true">
          ✦
        </span>
        <p className="sr-muted" style={{ margin: 0 }}>
          今天還沒有想說的話。等你多用一點，我會慢慢認識你。
        </p>
      </div>
    )
  }

  return (
    <div className="sr-card sr-agent-msg">
      <span className="sr-agent-avatar" aria-hidden="true">
        ✦
      </span>
      <div>
        <p className="sr-agent-title">{view.title}</p>
        <p className="sr-agent-body">{view.body}</p>
      </div>
    </div>
  )
}
