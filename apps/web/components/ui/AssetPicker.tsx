'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export type PickableAsset = { id: string; label: string }

/**
 * 資產選擇器（取代「手貼 asset UUID」）。受控：open + onPick/onClose。
 */
export function AssetPicker({
  open,
  assets,
  title,
  onPick,
  onClose,
}: {
  open: boolean
  assets: PickableAsset[]
  title?: string
  onPick: (id: string) => void
  onClose: () => void
}) {
  const [mounted, setMounted] = useState(false)
  const [q, setQ] = useState('')
  useEffect(() => setMounted(true), [])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !mounted) return null

  const filtered = q ? assets.filter((a) => a.label.toLowerCase().includes(q.toLowerCase())) : assets

  return createPortal(
    <div className="sr-dialog-scrim" onClick={onClose}>
      <div className="sr-dialog sr-dialog-picker" role="dialog" aria-modal="true" aria-label={title ?? '選圖片'} onClick={(e) => e.stopPropagation()}>
        <h2 className="sr-dialog-title">{title ?? '選一張圖片'}</h2>
        {assets.length === 0 ? (
          <p className="sr-dialog-message">還沒有可用的圖片，先到 Library 上傳。</p>
        ) : (
          <>
            <input className="sr-input" style={{ width: '100%' }} placeholder="搜尋檔名…" value={q} onChange={(e) => setQ(e.target.value)} />
            <ul className="sr-stack" style={{ listStyle: 'none', margin: 'var(--sr-space-2) 0 0', padding: 0, gap: '4px', maxHeight: '50vh', overflowY: 'auto' }}>
              {filtered.map((a) => (
                <li key={a.id}>
                  <button type="button" className="sr-button sr-button-secondary" style={{ width: '100%', textAlign: 'left' }} onClick={() => onPick(a.id)}>
                    {a.label}
                  </button>
                </li>
              ))}
              {filtered.length === 0 && <li className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)', padding: 'var(--sr-space-2)' }}>沒有符合的檔案。</li>}
            </ul>
          </>
        )}
        <div className="sr-dialog-actions">
          <button type="button" className="sr-button sr-button-secondary" onClick={onClose}>
            取消
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
