'use client'

import { useActionState, useState } from 'react'
import { signInWithPassword, registerWithPassword, type AuthActionState } from '../actions'

const initial: AuthActionState = { status: 'idle' }

/**
 * 帳號密碼登入 / 註冊。
 *
 * 密碼登入不寄信 —— SMTP 還沒好時仍能進站。註冊在站台密碼閘門後面，
 * 所以不需要邀請；註冊完會導去綁定頁引導綁 Google / LINE。
 */
export function PasswordAuth({ next }: { next: string }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const action = mode === 'signin' ? signInWithPassword : registerWithPassword
  const [state, formAction, pending] = useActionState(action, initial)

  return (
    <div style={{ marginTop: 'var(--sr-space-4)' }}>
      <div className="sr-row" style={{ gap: 'var(--sr-space-2)', marginBottom: 'var(--sr-space-3)' }}>
        <button
          type="button"
          className={`sr-button ${mode === 'signin' ? '' : 'sr-button-secondary'}`}
          aria-pressed={mode === 'signin'}
          onClick={() => setMode('signin')}
        >
          登入
        </button>
        <button
          type="button"
          className={`sr-button ${mode === 'signup' ? '' : 'sr-button-secondary'}`}
          aria-pressed={mode === 'signup'}
          onClick={() => setMode('signup')}
        >
          註冊
        </button>
      </div>

      <form action={formAction} className="sr-stack" style={{ gap: 'var(--sr-space-3)' }}>
        <input type="hidden" name="next" value={next} />

        <div>
          <label className="sr-label" htmlFor="pw-email">
            Email
          </label>
          <input
            className="sr-input"
            id="pw-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            disabled={pending}
          />
        </div>

        <div>
          <label className="sr-label" htmlFor="pw-password">
            密碼
          </label>
          <input
            className="sr-input"
            id="pw-password"
            name="password"
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            required
            minLength={mode === 'signup' ? 8 : undefined}
            placeholder={mode === 'signup' ? '至少 8 個字' : '密碼'}
            disabled={pending}
          />
        </div>

        {state.status === 'error' && state.message && (
          <p className="sr-message sr-message-error" role="alert">
            ✕ {state.message}
          </p>
        )}

        <button type="submit" className="sr-button" disabled={pending}>
          {pending ? '處理中…' : mode === 'signin' ? '登入' : '註冊並進入'}
        </button>
      </form>

      {mode === 'signup' && (
        <p className="sr-muted" style={{ marginTop: 'var(--sr-space-2)', marginBottom: 0 }}>
          註冊後會引導你綁定 Google 或 LINE，之後用哪種登入都是同一個帳號。
        </p>
      )}
    </div>
  )
}
