'use client'

import { useActionState, useState } from 'react'
import { resetPassword, type AuthActionState } from '../actions'
import { PasswordField } from '../PasswordField'
import { PasswordStrengthMeter } from '../PasswordStrengthMeter'

const initial: AuthActionState = { status: 'idle' }

export function ResetForm() {
  const [password, setPassword] = useState('')
  const [state, formAction, pending] = useActionState(resetPassword, initial)

  return (
    <form action={formAction} className="sr-stack" style={{ gap: 'var(--sr-space-3)' }}>
      <div className="sr-stack" style={{ gap: 'var(--sr-space-1)' }}>
        <PasswordField
          name="password"
          label="新密碼"
          autoComplete="new-password"
          minLength={8}
          placeholder="至少 8 個字"
          disabled={pending}
          value={password}
          onChange={setPassword}
        />
        <PasswordStrengthMeter password={password} />
      </div>

      {state.status === 'error' && state.message && (
        <p className="sr-message sr-message-error" role="alert">
          ✕ {state.message}
        </p>
      )}

      <button type="submit" className="sr-button" disabled={pending}>
        {pending ? '更新中…' : '設定新密碼並登入'}
      </button>
    </form>
  )
}
