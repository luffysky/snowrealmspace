'use client'

import { useState } from 'react'
import type { ProviderKey } from '@/lib/integrations/providers'
import { FilePickerDialog } from './FilePickerDialog'

/** 單一已連接帳號（同 provider 可有多個）。 */
type Account = {
  id: string
  status: string
  lastSyncedAt: string | null
  lastError: string | null
  accountLabel: string | null
}

type Item = {
  provider: ProviderKey
  label: string
  connectable: boolean
  connections: Account[]
}

const STATUS_LABEL: Record<string, string> = {
  active: '已連接',
  expired: '授權過期',
  revoked: '已中斷',
  error: '連線異常',
}

async function apiPost<T>(url: string): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
    const json = (await res.json().catch(() => null)) as { data?: T; error?: { message?: string } } | null
    if (!res.ok || !json || json.error) return { ok: false, message: json?.error?.message ?? `HTTP ${res.status}` }
    return { ok: true, data: json.data as T }
  } catch (err) {
    return { ok: false, message: `網路錯誤：${(err as Error).message}` }
  }
}

export function IntegrationsClient({ items, isOwner }: { items: Item[]; isOwner: boolean }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // 開著檔案選擇器的那條連線（provider + label 供 Figma container 判斷與標題）
  const [picking, setPicking] = useState<{ connectionId: string; provider: ProviderKey; label: string } | null>(null)

  async function connect(provider: string) {
    setBusy(provider)
    setError(null)
    const r = await apiPost<{ authorizeUrl: string }>(`/api/integrations/${provider}/connect`)
    if (!r.ok) {
      setBusy(null)
      return setError(r.message)
    }
    window.location.href = r.data.authorizeUrl // 導去 provider 授權頁
  }

  async function disconnect(connectionId: string, purge: boolean) {
    setBusy(connectionId)
    setError(null)
    try {
      const res = await fetch(`/api/integrations/${connectionId}?purgeData=${purge ? 'true' : 'false'}`, {
        method: 'DELETE',
      })
      const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
      if (!res.ok || json?.error) {
        setBusy(null)
        return setError(json?.error?.message ?? `中斷失敗（HTTP ${res.status}）`)
      }
      window.location.reload()
    } catch (err) {
      setBusy(null)
      setError(`網路錯誤：${(err as Error).message}`)
    }
  }

  return (
    <div style={{ marginTop: 'var(--sr-space-4)', display: 'grid', gap: 'var(--sr-space-3)' }}>
      {picking && (
        <FilePickerDialog
          connectionId={picking.connectionId}
          provider={picking.provider}
          label={picking.label}
          onClose={() => setPicking(null)}
        />
      )}
      {error && (
        <p className="sr-card" role="alert" style={{ color: 'var(--sr-danger)', borderColor: 'var(--sr-danger)' }}>
          {error}
        </p>
      )}

      {items.map((it) => {
        // 只顯示仍有效的帳號（已中斷 revoked 的列保留在 DB 供「同帳號重新連接」比對，但不列出）。
        const accounts = it.connections.filter((c) => c.status !== 'revoked')
        const hasAccounts = accounts.length > 0
        return (
          <section key={it.provider} className="sr-card" style={{ minWidth: 0 }}>
            <div className="sr-row" style={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--sr-space-2)' }}>
              <strong style={{ fontSize: 'var(--sr-text-lg)', minWidth: 0, overflowWrap: 'anywhere' }}>{it.label}</strong>
              <span className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)', flexShrink: 0 }}>
                {hasAccounts ? `已連接 ${accounts.length} 個帳號` : it.connectable ? '未連接' : '尚未開放'}
              </span>
            </div>

            {!it.connectable && !hasAccounts && (
              <p className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)', margin: 'var(--sr-space-2) 0 0' }}>
                這個工具即將支援（伺服器尚未設定憑證）。
              </p>
            )}

            {/* 每個已連接帳號各一列 */}
            {hasAccounts && (
              <div style={{ display: 'grid', gap: 'var(--sr-space-2)', marginTop: 'var(--sr-space-3)' }}>
                {accounts.map((conn, idx) => {
                  const accountName = conn.accountLabel && conn.accountLabel.length > 0 ? conn.accountLabel : `帳號 ${idx + 1}`
                  return (
                    <div
                      key={conn.id}
                      style={{
                        minWidth: 0,
                        padding: 'var(--sr-space-3)',
                        borderRadius: 'var(--sr-radius-sm)',
                        border: 'var(--sr-border-width) solid var(--sr-border)',
                      }}
                    >
                      <div className="sr-row" style={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--sr-space-2)' }}>
                        <strong style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{accountName}</strong>
                        <span className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)', flexShrink: 0 }}>
                          {STATUS_LABEL[conn.status] ?? conn.status}
                        </span>
                      </div>

                      <p className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)', margin: 'var(--sr-space-2) 0 0', overflowWrap: 'anywhere' }}>
                        上次同步：{conn.lastSyncedAt ? new Date(conn.lastSyncedAt).toLocaleString('zh-TW') : '尚未同步'}
                        {conn.lastError ? `．最近錯誤：${conn.lastError}` : ''}
                      </p>

                      {isOwner && (
                        <div className="sr-row" style={{ marginTop: 'var(--sr-space-3)', gap: 'var(--sr-space-2)', flexWrap: 'wrap' }}>
                          {conn.status === 'active' && confirming !== conn.id && (
                            <button
                              type="button"
                              className="sr-button"
                              onClick={() => setPicking({ connectionId: conn.id, provider: it.provider, label: it.label })}
                              disabled={busy !== null}
                            >
                              選擇檔案同步
                            </button>
                          )}

                          {confirming !== conn.id && (
                            <button
                              type="button"
                              className="sr-button-secondary sr-button"
                              onClick={() => setConfirming(conn.id)}
                              disabled={busy !== null}
                            >
                              中斷連線
                            </button>
                          )}

                          {confirming === conn.id && (
                            <div style={{ display: 'grid', gap: 'var(--sr-space-2)', minWidth: 0 }}>
                              <p className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)', margin: 0 }}>
                                中斷「{accountName}」後，這個帳號帶進來的作品與版本要怎麼處理？
                              </p>
                              <div className="sr-row" style={{ gap: 'var(--sr-space-2)', flexWrap: 'wrap' }}>
                                <button
                                  type="button"
                                  className="sr-button-secondary sr-button"
                                  onClick={() => void disconnect(conn.id, false)}
                                  disabled={busy !== null}
                                >
                                  保留（標記暫停）
                                </button>
                                <button
                                  type="button"
                                  className="sr-button-danger sr-button"
                                  onClick={() => void disconnect(conn.id, true)}
                                  disabled={busy !== null}
                                >
                                  一併刪除派生資料
                                </button>
                                <button
                                  type="button"
                                  className="sr-button-secondary sr-button"
                                  onClick={() => setConfirming(null)}
                                  disabled={busy !== null}
                                >
                                  取消
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* 連接／連接另一個帳號：即使已有帳號也保留，讓使用者加入更多 Canva/Figma 帳號 */}
            {isOwner && it.connectable && (
              <div className="sr-row" style={{ marginTop: 'var(--sr-space-3)', gap: 'var(--sr-space-2)', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={hasAccounts ? 'sr-button-secondary sr-button' : 'sr-button'}
                  onClick={() => void connect(it.provider)}
                  disabled={busy !== null}
                >
                  {busy === it.provider ? '前往授權…' : hasAccounts ? '＋ 連接另一個帳號' : `連接 ${it.label}`}
                </button>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
