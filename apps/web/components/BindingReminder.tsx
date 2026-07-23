'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

const DISMISS_KEY = 'sr-binding-reminder-dismissed'

/**
 * 綁定救援方式的提醒橫幅。
 *
 * 只有「沒有任何救援方式」的帳號（由伺服器判斷後才 render 這個元件）會看到。
 * 使用者可以先關掉這次的提醒（存 localStorage），但只要還沒綁，
 * 下次進站又會出現 —— 因為忘記密碼真的會救不回來。綁好後伺服器就不再 render。
 */
export function BindingReminder() {
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === '1')
  }, [])

  if (dismissed) return null

  return (
    <div
      role="status"
      className="sr-card"
      style={{
        borderInlineStart: '4px solid var(--sr-accent)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 'var(--sr-space-3)',
        marginBottom: 'var(--sr-space-4)',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: '1.4rem' }}>
        🔑
      </span>
      <div style={{ flex: '1 1 16rem', minWidth: 0 }}>
        <strong>綁一個找得回來的方式</strong>
        <p className="sr-muted" style={{ margin: '2px 0 0' }}>
          這個帳號還沒綁 email／Google／LINE。忘記密碼時會沒辦法找回，
          花 30 秒綁一個吧。
        </p>
      </div>
      <div className="sr-row" style={{ gap: 'var(--sr-space-2)', flexShrink: 0 }}>
        <Link className="sr-button" href="/settings/account">
          去綁定
        </Link>
        <button
          type="button"
          className="sr-button sr-button-secondary"
          onClick={() => {
            sessionStorage.setItem(DISMISS_KEY, '1')
            setDismissed(true)
          }}
        >
          稍後
        </button>
      </div>
    </div>
  )
}
