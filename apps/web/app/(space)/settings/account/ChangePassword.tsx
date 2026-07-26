'use client'

import { useActionState, useEffect, useRef } from 'react'
import { changePassword, type SettingsActionState } from '../actions'

const initial: SettingsActionState = { status: 'idle' }

/**
 * 更改密碼（登入方式頁）。
 *
 * 需要目前密碼 + 新密碼。這條路不寄信，純使用者名稱帳號（沒有真信箱）也能用。
 * 忘記密碼是另一條（/forgot，寄重設信，需要真 email）。
 */
export function ChangePassword() {
  const [state, formAction, pending] = useActionState(changePassword, initial)
  const formRef = useRef<HTMLFormElement>(null)

  // 成功後清掉輸入框，避免密碼留在畫面上
  useEffect(() => {
    if (state.status === 'saved') formRef.current?.reset()
  }, [state])

  return (
    <form ref={formRef} action={formAction} className="sr-stack" style={{ gap: 'var(--sr-space-3)' }}>
      <label className="sr-field">
        <span className="sr-label">目前的密碼</span>
        <input
          className="sr-input"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      <label className="sr-field">
        <span className="sr-label">新密碼</span>
        <input
          className="sr-input"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <span className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)' }}>
          至少 8 個字。
        </span>
      </label>

      <div>
        <button type="submit" className="sr-button sr-button-secondary" disabled={pending}>
          {pending ? '更新中…' : '更改密碼'}
        </button>
      </div>

      {state.status === 'error' && state.message && (
        <p className="sr-message sr-message-error" role="alert" style={{ margin: 0 }}>
          ✕ {state.message}
        </p>
      )}
      {state.status === 'saved' && state.message && (
        <p className="sr-message sr-message-success" role="status" style={{ margin: 0 }}>
          ✓ {state.message}
        </p>
      )}
    </form>
  )
}
