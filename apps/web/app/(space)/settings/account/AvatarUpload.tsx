'use client'

import { useEffect, useRef, useState } from 'react'
import { uploadAsset } from '@/lib/upload-asset'

/**
 * 大頭貼上傳。走既有 assets 管線（uploadAsset，ADR-005）→ 綁 profiles.avatar_asset_id。
 * 顯示用短期 signed URL（bucket 是 private，經 /api/assets/[id]/url 拿）。
 */
export function AvatarUpload({
  spaceId,
  initialAssetId,
}: {
  spaceId: string
  initialAssetId: string | null
}) {
  const [assetId, setAssetId] = useState<string | null>(initialAssetId)
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 有 assetId 就換成 signed URL 顯示
  useEffect(() => {
    let cancelled = false
    if (!assetId) {
      setUrl(null)
      return
    }
    void (async () => {
      try {
        // 必帶 x-space-id：/api/assets/[id]/url 走 resolveContext，沒 header 會 missing_space
        // → 回 401，signed URL 拿不到、大頭貼一直不顯示（就是「上傳後沒變」的原因）
        const res = await fetch(`/api/assets/${assetId}/url`, { headers: { 'x-space-id': spaceId } })
        if (!res.ok) return
        const body = (await res.json()) as { data: { url: string } }
        if (!cancelled) setUrl(body.data.url)
      } catch {
        /* 顯示失敗就留佔位，不擋操作 */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [assetId, spaceId])

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setNotice({ kind: 'error', text: '請選圖片檔。' })
      return
    }
    setBusy(true)
    setNotice(null)
    try {
      const id = await uploadAsset(file, spaceId)
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ avatarAssetId: id }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message: string } } | null
        setNotice({ kind: 'error', text: `✕ ${body?.error?.message ?? '設定失敗。'}` })
        return
      }
      setAssetId(id)
      setNotice({ kind: 'ok', text: '✓ 大頭貼已更新。' })
    } catch (err) {
      setNotice({ kind: 'error', text: `✕ ${(err as Error).message}` })
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function remove() {
    setBusy(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ avatarAssetId: null }),
      })
      if (!res.ok) {
        setNotice({ kind: 'error', text: '✕ 移除失敗。' })
        return
      }
      setAssetId(null)
      setNotice({ kind: 'ok', text: '✓ 已移除大頭貼。' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sr-stack" style={{ gap: 'var(--sr-space-3)' }}>
      <div className="sr-row" style={{ gap: 'var(--sr-space-4)', alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="sr-avatar" aria-hidden={!url}>
          {url ? (
            <img src={url} alt="目前的大頭貼" />
          ) : (
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-3.5 3.6-6 8-6s8 2.5 8 6" strokeLinecap="round" />
            </svg>
          )}
        </span>

        <div className="sr-row" style={{ gap: 'var(--sr-space-2)', flexWrap: 'wrap' }}>
          <button type="button" className="sr-button sr-button-secondary" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? '處理中…' : url ? '更換' : '上傳大頭貼'}
          </button>
          {assetId && (
            <button type="button" className="sr-linkish" disabled={busy} onClick={() => void remove()}>
              移除
            </button>
          )}
        </div>

        <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => void onPick(e)} />
      </div>

      {notice && (
        <p className={`sr-message ${notice.kind === 'error' ? 'sr-message-error' : 'sr-message-success'}`} role="status">
          {notice.text}
        </p>
      )}
    </div>
  )
}
