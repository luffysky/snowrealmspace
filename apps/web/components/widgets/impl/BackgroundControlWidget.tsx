'use client'

import { useEffect, useState } from 'react'
import type { WidgetProps } from '../types'

type Current = {
  current: { id: string; name: string | null; type: string } | null
  playMode?: string
}

/** 顯示目前背景，並提供前往設定的入口。 */
export default function BackgroundControlWidget({ spaceId }: WidgetProps) {
  const [state, setState] = useState<Current | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetch('/api/background-playlists/current', { headers: { 'x-space-id': spaceId } })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { data?: Current } | null) => {
        if (!cancelled) setState(b?.data ?? { current: null })
      })
      .catch(() => {
        if (!cancelled) setState({ current: null })
      })
    return () => {
      cancelled = true
    }
  }, [spaceId])

  return (
    <div className="sr-card sr-widget">
      <h3 className="sr-widget-title">背景</h3>

      {state === null && <p className="sr-muted">載入中…</p>}

      {state?.current === null && (
        <p className="sr-muted">
          目前沒有背景。到 Background Studio 加一張。
        </p>
      )}

      {state?.current && (
        <p className="sr-muted">
          正在顯示：{state.current.name ?? (state.current.type === 'gradient' ? '漸層' : '圖片')}
        </p>
      )}

      <a className="sr-button sr-button-secondary" href="/studio/background">
        調整背景
      </a>
    </div>
  )
}
