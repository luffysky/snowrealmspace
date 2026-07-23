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

function AssetTile({
  spaceId,
  asset,
  selected,
  onSelect,
  onDelete,
}: {
  spaceId: string
  asset: AssetRow
  selected: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const url = useSignedUrl(spaceId, asset.id, 'thumbnail')
  const processing = asset.kind === 'image' && asset.width === null
  const name = asset.original_filename ?? '未命名'

  return (
    <li className="sr-asset-tile">
      <button
        type="button"
        className="sr-asset-button"
        onClick={onSelect}
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

      <button
        type="button"
        className="sr-asset-delete"
        onClick={onDelete}
        aria-label={`刪除 ${name}`}
      >
        刪除
      </button>
    </li>
  )
}

export function AssetGrid({
  spaceId,
  assets,
  selectedId,
  onSelect,
  onDelete,
}: {
  spaceId: string
  assets: AssetRow[]
  selectedId: string | null
  onSelect: (asset: AssetRow) => void
  onDelete: (asset: AssetRow) => void
}) {
  return (
    <section className="sr-card">
      <h2 className="sr-section-title">你的檔案</h2>

      {assets.length === 0 ? (
        <p className="sr-muted">
          還沒有任何檔案。上傳一張圖，就可以用它生成一套主題。
        </p>
      ) : (
        <ul className="sr-asset-grid">
          {assets.map((asset) => (
            <AssetTile
              key={asset.id}
              spaceId={spaceId}
              asset={asset}
              selected={asset.id === selectedId}
              onSelect={() => onSelect(asset)}
              onDelete={() => onDelete(asset)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
