'use client'

import Link from 'next/link'
import { useActionState, useEffect, useState } from 'react'
import { signInWithPassword, registerWithPassword, type AuthActionState } from '../actions'
import { PasswordField } from '../PasswordField'
import { PasswordStrengthMeter } from '../PasswordStrengthMeter'

const initial: AuthActionState = { status: 'idle' }
const REMEMBER_KEY = 'sr-remember-account'

/**
 * 帳號密碼登入 / 註冊。
 *
 * 密碼登入不寄信 —— SMTP 還沒好時仍能進站。註冊在站台密碼閘門後面，
 * 所以不需要邀請；註冊完會導去綁定頁引導綁 Google / LINE。
 */
export function PasswordAuth({ next }: { next: string }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [password, setPassword] = useState('')
  const [account, setAccount] = useState('')
  const [remember, setRemember] = useState(true)
  const action = mode === 'signin' ? signInWithPassword : registerWithPassword
  const [state, formAction, pending] = useActionState(action, initial)

  // 記住帳號：存在瀏覽器 localStorage，下次自動帶入。
  // 只記帳號、不記密碼——密碼交給瀏覽器內建的密碼管理員（autocomplete）保存才安全，
  // 明文密碼放 localStorage 一旦被 XSS 讀到就全洩。
  useEffect(() => {
    const saved = window.localStorage.getItem(REMEMBER_KEY)
    if (saved) setAccount(saved)
    else setRemember(false)
  }, [])

  function persistAccount() {
    if (remember && account.trim()) window.localStorage.setItem(REMEMBER_KEY, account.trim())
    else window.localStorage.removeItem(REMEMBER_KEY)
  }

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

      <form
        action={formAction}
        onSubmit={persistAccount}
        className="sr-stack"
        style={{ gap: 'var(--sr-space-3)' }}
      >
        <input type="hidden" name="next" value={next} />

        <div>
          <label className="sr-label" htmlFor="pw-account">
            帳號
          </label>
          <input
            className="sr-input"
            id="pw-account"
            name="email"
            type="text"
            autoComplete="username"
            required
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            pattern={mode === 'signup' ? '[A-Za-z0-9_.@\\-]{3,254}' : undefined}
            placeholder={mode === 'signup' ? '取一個帳號（3–30 字，英數與 _ . -）' : '帳號'}
            disabled={pending}
          />
        </div>

        {mode === 'signin' && (
          <label className="sr-choice sr-choice-inline">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            記住帳號（密碼由瀏覽器的密碼管理員保存）
          </label>
        )}

        <div className="sr-stack" style={{ gap: 'var(--sr-space-1)' }}>
          <PasswordField
            name="password"
            label="密碼"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            minLength={mode === 'signup' ? 8 : undefined}
            placeholder={mode === 'signup' ? '至少 8 個字' : '密碼'}
            disabled={pending}
            value={password}
            onChange={setPassword}
          />
          {mode === 'signup' && <PasswordStrengthMeter password={password} />}
        </div>

        {mode === 'signin' && (
          <p style={{ margin: 0, textAlign: 'right' }}>
            <Link href="/forgot" className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)' }}>
              忘記密碼？
            </Link>
          </p>
        )}

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
          帳號＋密碼就能註冊，不需要 email。進去後會提醒你綁定 email／Google／LINE，
          這樣忘記密碼才有辦法找回。
        </p>
      )}
    </div>
  )
}
