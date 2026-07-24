'use client'

import { useEffect, useState } from 'react'

export type AssetRow = {
  id: string
  kind: string
  mime_type: string
  bytes: number
  width: number | null
  height: number | null
  original_filename: string | null
  is_favorite: boolean
  archived_at: string | null
  tags: string[]
  created_at: string
}

/** signed URL 有效期 15 分鐘，這裡在 12 分後重新取得，避免圖片突然變破圖。 */
const REFRESH_MS = 12 * 60 * 1000

function useSignedUrl(spaceId: string, assetId: string, rendition: string) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const res = await fetch(`/api/assets/${assetId}/url?rendition=${rendition}`, {
        headers: { 'x-space-id': spaceId },
      })
      if (!res.ok || cancelled) return
      const body = (await res.json()) as { data: { url: string } }
      if (!cancelled) setUrl(body.data.url)
    }

    void load()
    const timer = setInterval(() => void load(), REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [spaceId, assetId, rendition])

  return url
}

export type AssetActions = {
  onSelect: (a: AssetRow) => void
  onDelete: (a: AssetRow) => void
  onToggleFavorite: (a: AssetRow) => void
  onToggleArchive: (a: AssetRow) => void
  onEditTags: (a: AssetRow) => void
  onRename: (a: AssetRow) => void
  onCreateWork: (a: AssetRow) => void
}

function AssetTile({
  spaceId,
  asset,
  selected,
  actions,
}: {
  spaceId: string
  asset: AssetRow
  selected: boolean
  actions: AssetActions
}) {
  const url = useSignedUrl(spaceId, asset.id, 'thumbnail')
  const processing = asset.kind === 'image' && asset.width === null
  const name = asset.original_filename ?? '未命名'
  const archived = asset.archived_at !== null

  return (
    <li className="sr-asset-tile">
      <button
        type="button"
        className="sr-asset-fav"
        onClick={() => actions.onToggleFavorite(asset)}
        aria-pressed={asset.is_favorite}
        aria-label={asset.is_favorite ? `取消收藏 ${name}` : `收藏 ${name}`}
        title={asset.is_favorite ? '取消收藏' : '收藏'}
      >
        {asset.is_favorite ? '★' : '☆'}
      </button>

      <button
        type="button"
        className="sr-asset-button"
        onClick={() => actions.onSelect(asset)}
        aria-pressed={selected}
        aria-label={`${name}${asset.kind === 'image' ? '，可用來生成主題' : ''}`}
      >
        <span className="sr-asset-thumb">
          {url && asset.kind === 'image' ? (
            /* signed URL 是動態且短期的，不適合 next/image 的最佳化管線 */
            <img src={url} alt="" loading="lazy" />
          ) : (
            <span className="sr-asset-placeholder" aria-hidden="true">
              {asset.kind === 'video' ? '影片' : asset.kind === 'pdf' ? 'PDF' : '…'}
            </span>
          )}
        </span>
        <span className="sr-asset-name">{name}</span>
        {processing && <span className="sr-muted">處理中…</span>}
      </button>

      {asset.tags.length > 0 && (
        <div className="sr-chip-row sr-asset-tags">
          {asset.tags.map((t) => (
            <span key={t} className="sr-chip sr-chip-tag">
              #{t}
            </span>
          ))}
        </div>
      )}

      <div className="sr-asset-actions">
        <button type="button" onClick={() => actions.onRename(asset)}>
          改名
        </button>
        <button type="button" onClick={() => actions.onEditTags(asset)}>
          標籤
        </button>
        {asset.kind === 'image' && (
          <button type="button" onClick={() => actions.onCreateWork(asset)}>
            設為作品
          </button>
        )}
        <button type="button" onClick={() => actions.onToggleArchive(asset)}>
          {archived ? '取消封存' : '封存'}
        </button>
        <button
          type="button"
          className="sr-asset-delete"
          onClick={() => actions.onDelete(asset)}
          aria-label={`刪除 ${name}`}
        >
          刪除
        </button>
      </div>
    </li>
  )
}

export function AssetGrid({
  spaceId,
  assets,
  selectedId,
  actions,
  loading,
}: {
  spaceId: string
  assets: AssetRow[]
  selectedId: string | null
  actions: AssetActions
  loading: boolean
}) {
  return (
    <section className="sr-card">
      <h2 className="sr-section-title">你的檔案</h2>

      {loading ? (
        <p className="sr-muted" aria-live="polite">
          載入中…
        </p>
      ) : assets.length === 0 ? (
        <p className="sr-muted">符合條件的檔案是空的。換個篩選，或上傳一張新的圖。</p>
      ) : (
        <ul className="sr-asset-grid">
          {assets.map((asset) => (
            <AssetTile
              key={asset.id}
              spaceId={spaceId}
              asset={asset}
              selected={asset.id === selectedId}
              actions={actions}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
