'use client'

import { useState } from 'react'
import type { LinkedIdentity } from '@snowrealm/db/identities'

type Provider = 'email' | 'google' | 'line'

const LABEL: Record<Provider, string> = {
  email: 'Email 登入連結',
  google: 'Google',
  line: 'LINE',
}

const DESCRIPTION: Record<Provider, string> = {
  email: '寄一封含登入連結的信到你的信箱。註冊時預設就有這一種。',
  google: '用 Google 帳號一鍵登入。',
  line: '用 LINE 帳號一鍵登入。',
}

export function LinkedAccounts({
  initial,
  lineAvailable,
  googleAvailable,
}: {
  initial: LinkedIdentity[]
  lineAvailable: boolean
  googleAvailable: boolean
}) {
  const [identities, setIdentities] = useState(initial)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const linked = new Set(identities.map((i) => i.provider))
  // 只剩一種時，那一種不可解綁 —— 按鈕直接停用並說明原因，
  // 比讓人按下去才收到錯誤好。
  const isLastMethod = identities.length <= 1

  async function unlink(identity: LinkedIdentity) {
    const label = LABEL[identity.provider]
    if (!confirm(`確定要解除「${label}」嗎？解除後就不能再用這個方式登入。`)) return

    setBusy(identity.id)
    setError(null)
    try {
      const res = await fetch('/api/auth/identities', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ identityId: identity.id }),
      })
      const body: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        setError((body as { error?: { message?: string } } | null)?.error?.message ?? '解除失敗。')
        return
      }
      setIdentities((body as { data: { identities: LinkedIdentity[] } }).data.identities)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="sr-stack">
      {error && (
        <p className="sr-message sr-message-error" role="alert">
          ✕ {error}
        </p>
      )}

      <ul className="sr-list" role="list">
        {identities.map((identity) => (
          <li key={identity.id} className="sr-list-row">
            <div>
              <strong>{LABEL[identity.provider]}</strong>
              <p className="sr-muted" style={{ margin: 0 }}>
                {identity.email ?? identity.displayName ?? '已連結'}
                {identity.lastUsedAt
                  ? ` · 最後使用 ${new Date(identity.lastUsedAt).toLocaleDateString('zh-TW')}`
                  : ''}
              </p>
            </div>

            <button
              type="button"
              className="sr-button sr-button-secondary"
              onClick={() => void unlink(identity)}
              disabled={busy !== null || isLastMethod}
              title={isLastMethod ? '這是你唯一的登入方式，不能解除。' : undefined}
            >
              {busy === identity.id ? '解除中…' : '解除連結'}
            </button>
          </li>
        ))}
      </ul>

      {isLastMethod && (
        <p className="sr-muted" style={{ margin: 0 }}>
          目前只有一種登入方式，所以不能解除 —— 解除後你就進不來了。
          先綁定另一種，這個按鈕就會打開。
        </p>
      )}

      <div className="sr-stack" style={{ gap: 'var(--sr-space-3)' }}>
        {!linked.has('google') && (
          <LinkButton
            href="/api/auth/link/google"
            label="綁定 Google"
            description={DESCRIPTION.google}
            available={googleAvailable}
            unavailableReason="Google 登入尚未設定。需要先在 Google Cloud Console 建立 OAuth 用戶端。"
          />
        )}

        {!linked.has('line') && (
          <LinkButton
            href="/api/auth/line/start?intent=link"
            label="綁定 LINE"
            description={DESCRIPTION.line}
            available={lineAvailable}
            unavailableReason="LINE 登入尚未設定。需要先在 LINE Developers Console 建立 Login channel。"
          />
        )}
      </div>
    </div>
  )
}

/**
 * 未設定的 provider 顯示為停用並說明原因，而不是隱藏。
 * 隱藏會讓人以為產品不支援；停用＋原因才是實話（Q6：無假按鈕）。
 */
function LinkButton({
  href,
  label,
  description,
  available,
  unavailableReason,
}: {
  href: string
  label: string
  description: string
  available: boolean
  unavailableReason: string
}) {
  if (!available) {
    return (
      <div>
        <button type="button" className="sr-button sr-button-secondary" disabled>
          {label}
        </button>
        <p className="sr-muted" style={{ margin: 'var(--sr-space-1) 0 0' }}>
          {unavailableReason}
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* 用連結而非 fetch：OAuth 一定要整頁導向，不能在 fetch 裡完成 */}
      <a className="sr-button" href={href}>
        {label}
      </a>
      <p className="sr-muted" style={{ margin: 'var(--sr-space-1) 0 0' }}>
        {description}
      </p>
    </div>
  )
}
