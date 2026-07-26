'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * 幫 AI 夥伴命名。
 *
 * 還沒取名（名字仍是預設 'Agent'）→ 顯眼的引導卡，第一次就請使用者取名。
 * 已取名 → 顯示名字 + 可點的「改名」。只有空間擁有者能改。
 */
export function AiNaming({
  spaceId,
  initialName,
  isDefault,
  canEdit,
}: {
  spaceId: string
  initialName: string
  isDefault: boolean
  canEdit: boolean
}) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(isDefault ? '' : initialName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const next = value.trim()
    if (!next) {
      setError('請輸入名字。')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/agent/profile', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-space-id': spaceId },
        body: JSON.stringify({ displayName: next }),
      })
      const body = (await res.json().catch(() => null)) as
        | { data?: { displayName: string }; error?: { message?: string } }
        | null
      if (!res.ok) {
        setError(body?.error?.message ?? '儲存失敗。')
        return
      }
      setName(body?.data?.displayName ?? next)
      setEditing(false)
      router.refresh() // 讓對話裡的 AI 名字也更新
    } catch {
      setError('網路錯誤，請重試。')
    } finally {
      setBusy(false)
    }
  }

  // 還沒取名：第一次引導卡
  if (isDefault && !editing && canEdit) {
    return (
      <section className="sr-card sr-message-info" style={{ borderLeft: '4px solid var(--sr-accent)' }}>
        <h2 style={{ fontSize: 'var(--sr-text-lg)', marginTop: 0 }}>先幫你的 AI 夥伴取個名字吧</h2>
        <p className="sr-muted" style={{ marginTop: 0 }}>
          取個名字，之後在對話裡就用這個名字稱呼它。之後隨時能改。
        </p>
        <div className="sr-row" style={{ gap: 'var(--sr-space-2)', flexWrap: 'wrap' }}>
          <input
            className="sr-input"
            value={value}
            maxLength={40}
            placeholder="例如：雪凜、凜空、綠寶…"
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void save()
            }}
            style={{ flex: 1, minWidth: 160 }}
            aria-label="AI 夥伴的名字"
          />
          <button type="button" className="sr-button" disabled={busy} onClick={() => void save()}>
            {busy ? '儲存中…' : '就叫這個名字'}
          </button>
        </div>
        {error && (
          <p className="sr-message sr-message-error" role="alert" style={{ marginBottom: 0 }}>
            ✕ {error}
          </p>
        )}
      </section>
    )
  }

  // 編輯中
  if (editing) {
    return (
      <div className="sr-row" style={{ gap: 'var(--sr-space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          className="sr-input"
          value={value}
          maxLength={40}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void save()
            else if (e.key === 'Escape') setEditing(false)
          }}
          style={{ maxWidth: 220 }}
          aria-label="AI 夥伴的名字"
        />
        <button type="button" className="sr-button sr-button-secondary" disabled={busy} onClick={() => void save()}>
          {busy ? '儲存中…' : '儲存'}
        </button>
        <button type="button" className="sr-linkish" disabled={busy} onClick={() => setEditing(false)}>
          取消
        </button>
        {error && (
          <span className="sr-message sr-message-error" role="alert">
            {error}
          </span>
        )}
      </div>
    )
  }

  // 已取名：顯示 + 改名
  return (
    <p className="sr-muted" style={{ margin: 0 }}>
      你的 AI 夥伴：<strong style={{ color: 'var(--sr-text-primary)' }}>{name}</strong>
      {canEdit && (
        <button
          type="button"
          className="sr-linkish"
          style={{ marginLeft: 'var(--sr-space-2)' }}
          onClick={() => {
            setValue(name)
            setEditing(true)
          }}
        >
          改名
        </button>
      )}
    </p>
  )
}
