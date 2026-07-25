'use client'

import { useEffect, useState } from 'react'

/** 公開圖片縮圖：向 /api/public/asset-url 換 15 分鐘簽名 URL（該路由已驗證授權）。
 *  傳 token 時走分享連結授權（可看私人作品）。 */
export function PublicThumb({ snapshotId, alt, token }: { snapshotId: string; alt: string; token?: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let alive = true
    const q = token ? `snapshot=${snapshotId}&token=${encodeURIComponent(token)}` : `snapshot=${snapshotId}`
    fetch(`/api/public/asset-url?${q}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((b: { data: { url: string } }) => {
        if (alive) setUrl(b.data.url)
      })
      .catch(() => {
        if (alive) setFailed(true)
      })
    return () => {
      alive = false
    }
  }, [snapshotId, token])

  if (failed) return <div className="sr-public-thumb sr-public-thumb-empty">圖片載入失敗</div>
  if (!url) return <div className="sr-public-thumb sr-public-thumb-empty" aria-busy="true">載入中…</div>
  return <img src={url} alt={alt} className="sr-public-thumb" loading="lazy" />
}
