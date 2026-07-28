'use client'

import { useState } from 'react'
import type { ProviderKey } from '@/lib/integrations/providers'
import { FilePickerDialog } from './FilePickerDialog'

type Item = {
  provider: ProviderKey
  label: string
  connectable: boolean
  connection: { id: string; status: string; lastSyncedAt: string | null; lastError: string | null } | null
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
        const conn = it.connection
        const connected = conn !== null && conn.status !== 'revoked'
        return (
          <section key={it.provider} className="sr-card">
            <div className="sr-row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
              <strong style={{ fontSize: 'var(--sr-text-lg)' }}>{it.label}</strong>
              <span className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)' }}>
                {connected ? (STATUS_LABEL[conn.status] ?? conn.status) : it.connectable ? '未連接' : '尚未開放'}
              </span>
            </div>

            {connected && (
              <p className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)', margin: 'var(--sr-space-2) 0 0' }}>
                上次同步：{conn.lastSyncedAt ? new Date(conn.lastSyncedAt).toLocaleString('zh-TW') : '尚未同步'}
                {conn.lastError ? `．最近錯誤：${conn.lastError}` : ''}
              </p>
            )}

            {!it.connectable && !connected && (
              <p className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)', margin: 'var(--sr-space-2) 0 0' }}>
                這個工具即將支援（伺服器尚未設定憑證）。
              </p>
            )}

            {isOwner && (
              <div className="sr-row" style={{ marginTop: 'var(--sr-space-3)', gap: 'var(--sr-space-2)', flexWrap: 'wrap' }}>
                {connected && conn.status === 'active' && confirming !== conn.id && (
                  <button
                    type="button"
                    className="sr-button"
                    onClick={() => setPicking({ connectionId: conn.id, provider: it.provider, label: it.label })}
                    disabled={busy !== null}
                  >
                    選擇檔案同步
                  </button>
                )}

                {!connected && it.connectable && (
                  <button
                    type="button"
                    className="sr-button"
                    onClick={() => void connect(it.provider)}
                    disabled={busy !== null}
                  >
                    {busy === it.provider ? '前往授權…' : `連接 ${it.label}`}
                  </button>
                )}

                {connected && confirming !== conn.id && (
                  <button
                    type="button"
                    className="sr-button-secondary sr-button"
                    onClick={() => setConfirming(conn.id)}
                    disabled={busy !== null}
                  >
                    中斷連線
                  </button>
                )}

                {connected && confirming === conn.id && (
                  <div style={{ display: 'grid', gap: 'var(--sr-space-2)' }}>
                    <p className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)', margin: 0 }}>
                      中斷後，這個工具帶進來的作品與版本要怎麼處理？
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
          </section>
        )
      })}
    </div>
  )
}
