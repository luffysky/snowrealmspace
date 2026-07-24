'use client'

import { useEffect, useState } from 'react'

type ProviderRow = {
  provider: string
  label: string
  url: string
  placeholder: string
  hint: string
  free: boolean
  hasKey: boolean
  enabled: boolean
  lastOkAt: string | null
  lastError: string | null
}

export function AiKeysAdmin() {
  const [rows, setRows] = useState<ProviderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function load() {
    const res = await fetch('/api/admin/ai-keys')
    if (!res.ok) {
      setNotice('✕ 無法載入（需要站台管理員身份）。')
      setLoading(false)
      return
    }
    const body = (await res.json()) as { data: { providers: ProviderRow[] } }
    setRows(body.data.providers)
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  async function save(provider: string) {
    const key = (drafts[provider] ?? '').trim()
    if (!key) return
    setBusy(provider)
    setNotice(null)
    try {
      const res = await fetch(`/api/admin/ai-keys/${provider}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key, enabled: true, test: true }),
      })
      const body: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        setNotice(`✕ ${(body as { error?: { message?: string } } | null)?.error?.message ?? '儲存失敗。'}`)
        return
      }
      setNotice(`✓ ${provider} 金鑰已測試通過並儲存。`)
      setDrafts((d) => ({ ...d, [provider]: '' }))
      await load()
    } finally {
      setBusy(null)
    }
  }

  async function remove(provider: string) {
    if (!window.confirm(`移除 ${provider} 的金鑰？`)) return
    setBusy(provider)
    try {
      await fetch(`/api/admin/ai-keys/${provider}`, { method: 'DELETE' })
      await load()
      setNotice(`已移除 ${provider}。`)
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <p className="sr-muted">載入中…</p>

  return (
    <div className="sr-stack" style={{ marginTop: 'var(--sr-space-4, 16px)' }}>
      {notice && (
        <p className={`sr-message ${notice.startsWith('✕') ? 'sr-message-error' : 'sr-message-info'}`} role="status">
          {notice}
        </p>
      )}

      {rows.map((r) => (
        <section key={r.provider} className="sr-card sr-stack" style={{ gap: 'var(--sr-space-2, 8px)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <strong>{r.label}</strong>
            <span className="sr-chip sr-chip-tag">
              {r.hasKey ? (r.enabled ? '✓ 已設定' : '已設定（停用）') : r.free ? '免費 · 未設定' : '付費 · 未設定'}
            </span>
          </div>

          {r.lastError && <p className="sr-message sr-message-error" style={{ margin: 0 }}>{r.lastError}</p>}

          <div className="sr-form-cols" style={{ alignItems: 'end' }}>
            <label className="sr-field">
              <span>{r.hasKey ? '換一把新金鑰' : '貼上金鑰'}</span>
              <input
                className="sr-input"
                type="password"
                autoComplete="off"
                placeholder={r.placeholder}
                value={drafts[r.provider] ?? ''}
                onChange={(e) => setDrafts((d) => ({ ...d, [r.provider]: e.target.value }))}
              />
            </label>
          </div>

          <p className="sr-muted" style={{ margin: 0, fontSize: 'var(--sr-text-sm, 0.85rem)' }}>
            {r.hint} ·{' '}
            <a href={r.url} target="_blank" rel="noreferrer" className="sr-link">
              取得金鑰 ↗
            </a>
          </p>

          <div className="sr-btn-row">
            <button
              type="button"
              className="sr-button"
              disabled={busy === r.provider || !(drafts[r.provider] ?? '').trim()}
              onClick={() => void save(r.provider)}
            >
              {busy === r.provider ? '測試並儲存中…' : '測試並儲存'}
            </button>
            {r.hasKey && (
              <button
                type="button"
                className="sr-button sr-button-danger"
                disabled={busy === r.provider}
                onClick={() => void remove(r.provider)}
              >
                移除
              </button>
            )}
          </div>
        </section>
      ))}
    </div>
  )
}
