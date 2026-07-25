'use client'

import { useEffect, useState } from 'react'

type ShareLink = {
  id: string
  token: string
  expires_at: string | null
  revoked_at: string | null
  created_at: string
}

/** 某作品的唯讀分享連結：建立（可設到期）、複製、撤銷。 */
export function ShareLinksPanel({ spaceId, fileId }: { spaceId: string; fileId: string }) {
  const [links, setLinks] = useState<ShareLink[]>([])
  const [expiry, setExpiry] = useState('30')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch(`/api/share?designFileId=${fileId}`, { headers: { 'x-space-id': spaceId } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((b: { data: ShareLink[] }) => {
        if (alive) setLinks(b.data)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [fileId, spaceId])

  async function create() {
    setBusy(true)
    setMsg(null)
    try {
      const body: { designFileId: string; expiresInDays?: number } = { designFileId: fileId }
      if (expiry !== 'never') body.expiresInDays = parseInt(expiry, 10)
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-space-id': spaceId },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      const b = (await res.json()) as { data: ShareLink }
      setLinks((prev) => [b.data, ...prev])
      const url = `${window.location.origin}/s/${b.data.token}`
      await navigator.clipboard
        ?.writeText(url)
        .then(() => setMsg('連結已建立並複製到剪貼簿。'))
        .catch(() => setMsg('連結已建立。'))
    } catch {
      setMsg('建立失敗，請重試。')
    } finally {
      setBusy(false)
    }
  }

  async function revoke(id: string) {
    setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, revoked_at: new Date().toISOString() } : l)))
    try {
      await fetch(`/api/share/${id}`, { method: 'DELETE', headers: { 'x-space-id': spaceId } })
    } catch {
      /* UI 已標記；下次載入會反映真實狀態 */
    }
  }

  function copy(token: string) {
    const url = `${window.location.origin}/s/${token}`
    void navigator.clipboard?.writeText(url).then(() => setMsg('已複製。')).catch(() => setMsg('複製失敗。'))
  }

  function statusOf(l: ShareLink): { text: string; active: boolean } {
    if (l.revoked_at) return { text: '已撤銷', active: false }
    if (l.expires_at && new Date(l.expires_at) <= new Date()) return { text: '已過期', active: false }
    if (l.expires_at) return { text: `到期 ${l.expires_at.slice(0, 10)}`, active: true }
    return { text: '永久有效', active: true }
  }

  const activeLinks = links.filter((l) => statusOf(l).active)

  return (
    <details className="sr-share-panel">
      <summary style={{ cursor: 'pointer' }}>
        分享連結{activeLinks.length > 0 ? `（${activeLinks.length} 條有效）` : ''}
      </summary>
      <div className="sr-stack" style={{ marginTop: 'var(--sr-space-2)' }}>
        <div className="sr-row" style={{ gap: 'var(--sr-space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
          <label className="sr-field" style={{ margin: 0 }}>
            <span className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)' }}>有效期</span>
            <select className="sr-input" value={expiry} disabled={busy} onChange={(e) => setExpiry(e.target.value)}>
              <option value="7">7 天</option>
              <option value="30">30 天</option>
              <option value="90">90 天</option>
              <option value="never">永久</option>
            </select>
          </label>
          <button type="button" className="sr-button" onClick={() => void create()} disabled={busy}>
            建立唯讀連結
          </button>
          {msg && <span className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)' }}>{msg}</span>}
        </div>

        {links.length > 0 && (
          <ul className="sr-stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: '4px' }}>
            {links.map((l) => {
              const st = statusOf(l)
              return (
                <li key={l.id} className="sr-row" style={{ gap: 'var(--sr-space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                  <code style={{ fontSize: 'var(--sr-text-sm)', opacity: st.active ? 1 : 0.5 }}>/s/{l.token.slice(0, 10)}…</code>
                  <span className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)' }}>{st.text}</span>
                  {st.active && (
                    <>
                      <button type="button" className="sr-button sr-button-secondary" style={{ padding: '2px 8px' }} onClick={() => copy(l.token)}>
                        複製
                      </button>
                      <button type="button" className="sr-button sr-button-secondary" style={{ padding: '2px 8px' }} onClick={() => void revoke(l.id)}>
                        撤銷
                      </button>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <p className="sr-muted" style={{ margin: 0, fontSize: 'var(--sr-text-sm)' }}>
          連結是唯讀的，對「私人」作品也有效。撤銷後立刻失效。
        </p>
      </div>
    </details>
  )
}
