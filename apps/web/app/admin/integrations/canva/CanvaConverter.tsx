'use client'

import { useState } from 'react'

type Tokens = {
  accessToken: string
  refreshToken: string | null
  tokenType: string
  expiresInSec: number
  expiresAt: string
  scope: string | null
}

const AUTHORIZE_ENDPOINT = '/api/admin/integrations/canva/authorize'
const EXCHANGE_ENDPOINT = '/api/admin/integrations/canva/exchange'

async function apiPost<T>(url: string, body?: unknown): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    const init: RequestInit = { method: 'POST', headers: { 'Content-Type': 'application/json' } }
    if (body !== undefined) init.body = JSON.stringify(body)
    const res = await fetch(url, init)
    const json = (await res.json().catch(() => null)) as
      | { data?: T; error?: { message?: string } }
      | null
    if (!res.ok || !json || json.error) {
      return { ok: false, message: json?.error?.message ?? `請求失敗（HTTP ${res.status}）` }
    }
    return { ok: true, data: json.data as T }
  } catch (err) {
    return { ok: false, message: `網路錯誤：${(err as Error).message}` }
  }
}

function Secret({ label, value }: { label: string; value: string }) {
  const [shown, setShown] = useState(false)
  const [copied, setCopied] = useState(false)
  const masked = value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : '••••••'
  return (
    <div style={{ marginTop: 'var(--sr-space-3)' }}>
      <span className="sr-label">{label}</span>
      <div className="sr-field-row" style={{ display: 'flex', gap: 'var(--sr-space-2)', alignItems: 'center' }}>
        <code
          className="sr-input sr-input-mono"
          style={{ flex: 1, overflowX: 'auto', whiteSpace: 'nowrap', userSelect: 'all' }}
        >
          {shown ? value : masked}
        </code>
        <button type="button" className="sr-button-secondary sr-button" onClick={() => setShown((s) => !s)}>
          {shown ? '遮蔽' : '顯示'}
        </button>
        <button
          type="button"
          className="sr-button-secondary sr-button"
          onClick={() => {
            void navigator.clipboard.writeText(value).then(() => {
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            })
          }}
        >
          {copied ? '已複製' : '複製'}
        </button>
      </div>
    </div>
  )
}

function Result({ tokens }: { tokens: Tokens }) {
  return (
    <section className="sr-card" style={{ marginTop: 'var(--sr-space-4)', borderColor: 'var(--sr-accent)' }}>
      <h2 className="sr-section-title">換到的 Token</h2>
      <Secret label="access_token" value={tokens.accessToken} />
      {tokens.refreshToken && <Secret label="refresh_token" value={tokens.refreshToken} />}
      <p className="sr-muted" style={{ marginTop: 'var(--sr-space-3)', fontSize: 'var(--sr-text-sm)' }}>
        類型 {tokens.tokenType}．{tokens.expiresInSec} 秒後到期（約 {new Date(tokens.expiresAt).toLocaleString('zh-TW')}）
        {tokens.scope ? `．scope：${tokens.scope}` : ''}
      </p>
      <p className="sr-muted" style={{ marginTop: 'var(--sr-space-2)', fontSize: 'var(--sr-text-xs)' }}>
        access_token 到期後，用下方「更新 Token」貼 refresh_token 換新的即可。
      </p>
    </section>
  )
}

export function CanvaConverter({
  configured,
  redirectUri,
  scopes,
}: {
  configured: boolean
  redirectUri: string
  scopes: string[]
}) {
  const [authorizeUrl, setAuthorizeUrl] = useState<string | null>(null)
  const [genLoading, setGenLoading] = useState(false)
  const [callbackUrl, setCallbackUrl] = useState('')
  const [exLoading, setExLoading] = useState(false)
  const [refreshInput, setRefreshInput] = useState('')
  const [rfLoading, setRfLoading] = useState(false)
  const [tokens, setTokens] = useState<Tokens | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [urlCopied, setUrlCopied] = useState(false)

  if (!configured) {
    return (
      <section className="sr-card" style={{ marginTop: 'var(--sr-space-4)' }}>
        <h2 className="sr-section-title">尚未設定 Canva 憑證</h2>
        <p className="sr-muted" style={{ margin: 0 }}>
          請先在 Zeabur web 服務設定環境變數 <code className="sr-input-mono">CANVA_CLIENT_ID</code> 與{' '}
          <code className="sr-input-mono">CANVA_CLIENT_SECRET</code>（重啟後生效），再回來使用轉換器。
        </p>
        <p className="sr-muted" style={{ marginTop: 'var(--sr-space-2)', fontSize: 'var(--sr-text-sm)' }}>
          Canva app 後台的 redirect URL 要設成：<code className="sr-input-mono">{redirectUri}</code>
        </p>
      </section>
    )
  }

  async function generate() {
    setGenLoading(true)
    setError(null)
    const r = await apiPost<{ authorizeUrl: string }>(AUTHORIZE_ENDPOINT)
    setGenLoading(false)
    if (!r.ok) return setError(r.message)
    setAuthorizeUrl(r.data.authorizeUrl)
  }

  async function exchange() {
    setExLoading(true)
    setError(null)
    const r = await apiPost<Tokens>(EXCHANGE_ENDPOINT, { callbackUrl })
    setExLoading(false)
    if (!r.ok) return setError(r.message)
    setTokens(r.data)
  }

  async function refresh() {
    setRfLoading(true)
    setError(null)
    const r = await apiPost<Tokens>(EXCHANGE_ENDPOINT, { mode: 'refresh', refreshToken: refreshInput })
    setRfLoading(false)
    if (!r.ok) return setError(r.message)
    setTokens(r.data)
  }

  return (
    <>
      {error && (
        <p
          className="sr-card"
          role="alert"
          style={{ marginTop: 'var(--sr-space-4)', color: 'var(--sr-danger)', borderColor: 'var(--sr-danger)' }}
        >
          {error}
        </p>
      )}

      {/* 步驟 1 */}
      <section className="sr-card" style={{ marginTop: 'var(--sr-space-4)' }}>
        <h2 className="sr-section-title">1 · 產生授權連結</h2>
        <p className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)', marginTop: 0 }}>
          scope（全唯讀）：{scopes.join('、')}
        </p>
        <button type="button" className="sr-button" onClick={() => void generate()} disabled={genLoading}>
          {genLoading ? '產生中…' : authorizeUrl ? '重新產生' : '產生授權連結'}
        </button>
        {authorizeUrl && (
          <div style={{ marginTop: 'var(--sr-space-3)' }}>
            <div className="sr-field-row" style={{ display: 'flex', gap: 'var(--sr-space-2)', alignItems: 'center' }}>
              <code
                className="sr-input sr-input-mono"
                style={{ flex: 1, overflowX: 'auto', whiteSpace: 'nowrap' }}
              >
                {authorizeUrl}
              </code>
              <button
                type="button"
                className="sr-button-secondary sr-button"
                onClick={() => {
                  void navigator.clipboard.writeText(authorizeUrl).then(() => {
                    setUrlCopied(true)
                    setTimeout(() => setUrlCopied(false), 1500)
                  })
                }}
              >
                {urlCopied ? '已複製' : '複製'}
              </button>
            </div>
            <p style={{ marginTop: 'var(--sr-space-2)' }}>
              <a href={authorizeUrl} target="_blank" rel="noopener noreferrer" className="sr-link">
                在新分頁開啟並登入 Canva 授權 →
              </a>
            </p>
            <p className="sr-muted" style={{ fontSize: 'var(--sr-text-xs)', margin: 0 }}>
              連結 10 分鐘內有效，且必須在同一個瀏覽器完成（PKCE 暫存在你的 cookie）。
            </p>
          </div>
        )}
      </section>

      {/* 步驟 2 */}
      <section className="sr-card" style={{ marginTop: 'var(--sr-space-4)' }}>
        <h2 className="sr-section-title">2 · 貼回導回的網址</h2>
        <p className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)', marginTop: 0 }}>
          授權後 Canva 會導回 <code className="sr-input-mono">{redirectUri}</code>，
          那頁會顯示一條含 <code className="sr-input-mono">?code=…</code> 的網址與「複製網址」按鈕。
          把它複製貼到這裡即可（也可直接從瀏覽器網址列複製整條）。
        </p>
        <label className="sr-label" htmlFor="canva-callback">
          Canva 導回的完整網址
        </label>
        <textarea
          id="canva-callback"
          className="sr-input sr-input-mono"
          rows={3}
          value={callbackUrl}
          onChange={(e) => setCallbackUrl(e.target.value)}
          placeholder="https://snowrealm-space.snowrealm.pet/api/integrations/canva/callback?code=...&state=..."
          style={{ resize: 'vertical' }}
        />
        <button
          type="button"
          className="sr-button"
          onClick={() => void exchange()}
          disabled={exLoading || callbackUrl.trim().length === 0}
          style={{ marginTop: 'var(--sr-space-3)' }}
        >
          {exLoading ? '換取中…' : '換取 Token'}
        </button>
      </section>

      {tokens && <Result tokens={tokens} />}

      {/* 更新 token */}
      <section className="sr-card" style={{ marginTop: 'var(--sr-space-4)' }}>
        <h2 className="sr-section-title">更新 Token（可選）</h2>
        <p className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)', marginTop: 0 }}>
          access_token 到期時，貼上手上的 refresh_token 換一組新的。
        </p>
        <label className="sr-label" htmlFor="canva-refresh">
          refresh_token
        </label>
        <textarea
          id="canva-refresh"
          className="sr-input sr-input-mono"
          rows={2}
          value={refreshInput}
          onChange={(e) => setRefreshInput(e.target.value)}
          placeholder="貼上 refresh_token"
          style={{ resize: 'vertical' }}
        />
        <button
          type="button"
          className="sr-button-secondary sr-button"
          onClick={() => void refresh()}
          disabled={rfLoading || refreshInput.trim().length === 0}
          style={{ marginTop: 'var(--sr-space-3)' }}
        >
          {rfLoading ? '更新中…' : '用 refresh_token 換新'}
        </button>
      </section>
    </>
  )
}
