'use client'

import { useActionState, useState } from 'react'
import { sendMagicLink, verifyEmailCode, type AuthActionState } from '../actions'

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
  const [codeState, codeAction, codePending] = useActionState(verifyEmailCode, initialState)
  const [email, setEmail] = useState('')

  const errorText = state.status === 'error' ? state.message : error ? ERROR_MESSAGES[error] : null
  const sent = state.status === 'sent'

  return (
    <div className="sr-stack">
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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending || sent}
            aria-describedby={errorText ? 'login-error' : undefined}
            aria-invalid={errorText ? true : undefined}
          />
        </div>

        {errorText && (
          <p className="sr-message sr-message-error" id="login-error" role="alert">
            ✕ {errorText}
          </p>
        )}

        {sent && (
          <p className="sr-message sr-message-success" role="status">
            ✓ {state.message}
          </p>
        )}

        <button className="sr-button" type="submit" disabled={pending || sent}>
          {pending ? '寄送中…' : sent ? '已寄出' : '寄送登入連結 / 代碼'}
        </button>

        <p className="sr-muted">點信中的連結，或用下方輸入 6 位數代碼登入（跨裝置方便）。</p>
      </form>

      {/* 代碼登入：跨裝置用（電腦沒登 email，用手機收到的代碼在電腦登入） */}
      {sent && (
        <form action={codeAction} className="sr-stack" style={{ marginTop: 'var(--sr-space-2)' }}>
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="next" value={next} />
          <div>
            <label className="sr-label" htmlFor="otp">
              信中的 6 位數代碼
            </label>
            <input
              className="sr-input"
              id="otp"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              placeholder="123456"
              required
            />
          </div>
          {codeState.status === 'error' && codeState.message && (
            <p className="sr-message sr-message-error" role="alert">
              ✕ {codeState.message}
            </p>
          )}
          <button className="sr-button sr-button-secondary" type="submit" disabled={codePending}>
            {codePending ? '驗證中…' : '用代碼登入'}
          </button>
        </form>
      )}
    </div>
  )
}
