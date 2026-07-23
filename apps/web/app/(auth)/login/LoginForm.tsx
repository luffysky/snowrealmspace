'use client'

import { useActionState } from 'react'
import { sendMagicLink, type AuthActionState } from '../actions'

const initialState: AuthActionState = { status: 'idle' }

const ERROR_MESSAGES: Record<string, string> = {
  missing_code: '登入連結不完整，請重新索取。',
  invalid_link: '這個連結已失效或已被使用過，請重新索取。',
  invite_required: '目前為邀請制。請使用你收到的邀請連結進入。',
  invite_not_found: '邀請連結無效。',
  invite_expired: '邀請連結已過期，請索取新的。',
  invite_already_accepted: '這個邀請已經被使用過了。',
  invite_email_mismatch: '這個邀請是給另一個 email 的。',
  provisioning_failed: '建立空間時發生問題，請再試一次。',
}

export function LoginForm({
  inviteToken,
  next,
  error,
}: {
  inviteToken: string | null
  next: string
  error: string | null
}) {
  const [state, formAction, pending] = useActionState(sendMagicLink, initialState)

  const errorText = state.status === 'error' ? state.message : error ? ERROR_MESSAGES[error] : null

  return (
    <form action={formAction} className="sr-stack">
      {inviteToken && <input type="hidden" name="invite" value={inviteToken} />}
      <input type="hidden" name="next" value={next} />

      <div>
        <label className="sr-label" htmlFor="email">
          Email
        </label>
        <input
          className="sr-input"
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          disabled={pending || state.status === 'sent'}
          aria-describedby={errorText ? 'login-error' : undefined}
          aria-invalid={errorText ? true : undefined}
        />
      </div>

      {errorText && (
        <p className="sr-message sr-message-error" id="login-error" role="alert">
          ✕ {errorText}
        </p>
      )}

      {state.status === 'sent' && (
        <p className="sr-message sr-message-success" role="status">
          ✓ {state.message}
        </p>
      )}

      <button className="sr-button" type="submit" disabled={pending || state.status === 'sent'}>
        {pending ? '寄送中…' : state.status === 'sent' ? '已寄出' : '寄送登入連結'}
      </button>

      <p className="sr-muted">
        我們不使用密碼。點擊信中的連結即可登入。
      </p>
    </form>
  )
}
