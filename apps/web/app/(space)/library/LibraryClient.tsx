'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Uploader } from './Uploader'
import { AssetGrid, type AssetRow } from './AssetGrid'
import { ThemeFromImage } from './ThemeFromImage'

export function LibraryClient({
  spaceId,
  initialAssets,
}: {
  spaceId: string
  initialAssets: AssetRow[]
}) {
  const router = useRouter()
  const [assets, setAssets] = useState<AssetRow[]>(initialAssets)
  const [selected, setSelected] = useState<AssetRow | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const res = await fetch('/api/assets?limit=60', { headers: { 'x-space-id': spaceId } })
    if (!res.ok) return
    const body = (await res.json()) as { data: AssetRow[] }
    setAssets(body.data)
  }, [spaceId])

  /*
   * 上傳完成後縮圖不會馬上就緒（worker 還在處理）。
   * 有 pending 縮圖時定期重新整理，直到全部就緒 ——
   * 不這樣做的話使用者會一直看到破圖，直到手動重新整理。
   */
  useEffect(() => {
    const waiting = assets.some((a) => a.width === null && a.kind === 'image')
    if (!waiting) return
    const timer = setInterval(() => void refresh(), 3000)
    return () => clearInterval(timer)
  }, [assets, refresh])

  async function handleDelete(asset: AssetRow, cascade = false) {
    const res = await fetch(`/api/assets/${asset.id}${cascade ? '?cascade=true' : ''}`, {
      method: 'DELETE',
      headers: { 'x-space-id': spaceId },
    })
    const body: unknown = await res.json().catch(() => null)

    if (res.status === 409) {
      const details = (body as { error?: { details?: { references?: { label: string }[] } } })
        ?.error?.details
      const labels = (details?.references ?? []).map((r) => r.label).join('、')
      const confirmed = window.confirm(
        `這個檔案還在使用中：\n${labels}\n\n一併移除這些引用並刪除嗎？`,
      )
      if (confirmed) await handleDelete(asset, true)
      return
    }

    if (!res.ok) {
      const message =
        (body as { error?: { message?: string } } | null)?.error?.message ?? '刪除失敗。'
      setNotice(`✕ ${message}`)
      return
    }

    setAssets((prev) => prev.filter((a) => a.id !== asset.id))
    if (selected?.id === asset.id) setSelected(null)
    setNotice('已刪除。30 天內都還可以復原。')
  }

  return (
    <div className="sr-stack">
      {notice && (
        <p className="sr-message sr-message-info" role="status">
          {notice}
        </p>
      )}

      <Uploader spaceId={spaceId} onUploaded={() => void refresh()} />

      {selected && (
        <ThemeFromImage
          spaceId={spaceId}
          asset={selected}
          onClose={() => setSelected(null)}
          onCreated={() => {
            setSelected(null)
            router.refresh()
          }}
        />
      )}

      <AssetGrid
        spaceId={spaceId}
        assets={assets}
        onSelect={(a) => setSelected(a.kind === 'image' ? a : null)}
        onDelete={(a) => void handleDelete(a)}
        selectedId={selected?.id ?? null}
      />
    </div>
  )
}
