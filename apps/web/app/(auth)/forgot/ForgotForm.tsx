'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { requestPasswordReset, type AuthActionState } from '../actions'

const initial: AuthActionState = { status: 'idle' }

export function ForgotForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initial)

  if (state.status === 'sent') {
    return (
      <div className="sr-stack" style={{ gap: 'var(--sr-space-3)' }}>
        <p className="sr-message sr-message-success" role="status">
          ✓ {state.message}
        </p>
        <p className="sr-muted">
          <Link href="/login">← 回到登入</Link>
        </p>
      </div>
    )
  }

  return (
    <form action={formAction} className="sr-stack" style={{ gap: 'var(--sr-space-3)' }}>
      <div>
        <label className="sr-label" htmlFor="forgot-email">
          帳號的 email
        </label>
        <input
          className="sr-input"
          id="forgot-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          disabled={pending}
        />
      </div>

      {state.status === 'error' && state.message && (
        <p className="sr-message sr-message-error" role="alert">
          ✕ {state.message}
        </p>
      )}

      <button type="submit" className="sr-button" disabled={pending}>
        {pending ? '處理中…' : '寄送重設連結'}
      </button>

      <p className="sr-muted" style={{ margin: 0 }}>
        <Link href="/login">← 回到登入</Link>
      </p>
    </form>
  )
}
