'use client'

import { useEffect, useState } from 'react'

/** 公開圖片縮圖：向 /api/public/asset-url 換 15 分鐘簽名 URL（該路由已驗證作品公開）。 */
export function PublicThumb({ snapshotId, alt }: { snapshotId: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let alive = true
    fetch(`/api/public/asset-url?snapshot=${snapshotId}`)
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
  }, [snapshotId])

  if (failed) return <div className="sr-public-thumb sr-public-thumb-empty">圖片載入失敗</div>
  if (!url) return <div className="sr-public-thumb sr-public-thumb-empty" aria-busy="true">載入中…</div>
  return <img src={url} alt={alt} className="sr-public-thumb" loading="lazy" />
}
