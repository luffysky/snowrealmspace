'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * 上線心跳（無 UI）。掛在 (space) layout，登入者在站內時定期回報。
 *
 * 行為：
 *   - 掛載時取得（或建立）sessionId，存在 sessionStorage（分頁生命週期）。
 *   - 掛載即送一次；之後每 60 秒送一次；切回可見分頁時補送一次。
 *   - 分頁隱藏（切走 / 最小化）時不送，避免灌爆在線時長。
 *   - Fire-and-forget：任何錯誤都吞掉，永遠不影響頁面。
 *
 * 只送 { sessionId, path }；裝置 / 地區由後端從 header 推導（前端不碰）。
 */

const SESSION_KEY = 'sr-session-id'
const INTERVAL_MS = 60_000

function getSessionId(): string | null {
  try {
    let id = sessionStorage.getItem(SESSION_KEY)
    if (!id) {
      id = crypto.randomUUID()
      sessionStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    // 隱私模式 / 停用 storage → 不記，靜默略過
    return null
  }
}

export function SessionHeartbeat() {
  const pathname = usePathname()

  useEffect(() => {
    let cancelled = false

    const beat = () => {
      if (document.visibilityState !== 'visible') return
      const sessionId = getSessionId()
      if (!sessionId || cancelled) return
      void fetch('/api/session/heartbeat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, path: window.location.pathname }),
        keepalive: true,
      }).catch(() => {
        /* fire-and-forget：吞掉錯誤，不影響頁面 */
      })
    }

    beat() // 掛載即送一次
    const timer = setInterval(beat, INTERVAL_MS)

    const onVisible = () => {
      if (document.visibilityState === 'visible') beat()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
    // pathname 變動時重跑：換頁立即補一次心跳（讓 current_path / page_count 即時）
  }, [pathname])

  return null
}
