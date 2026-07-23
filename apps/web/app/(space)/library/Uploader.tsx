'use client'

import { useCallback, useRef, useState } from 'react'
import { ALL_ALLOWED_MIME, LIMITS, limitForMime, kindForMime } from '@snowrealm/validation'

/**
 * 上傳。實作 02-domain-model.md §5.1 的三段流程。
 *
 * 檔案直傳 R2，不經過我們的伺服器 —— 這讓大檔上傳不佔用 serverless 的
 * 記憶體與時間上限，也讓進度條能反映真實的傳輸狀態。
 */

export type UploadState = {
  id: string
  filename: string
  bytes: number
  progress: number
  status: 'hashing' | 'uploading' | 'processing' | 'done' | 'failed' | 'duplicate'
  message?: string
  assetId?: string
}

/** SHA-256，用於去重。在瀏覽器算好再送，伺服器不必重算。 */
/**
 * 用 <video> 量時長。
 *
 * 量不出來時回 null 而不是 0 —— 0 會通過上限檢查。
 * 回 null 的情況（瀏覽器不支援該 codec、檔案損毀）交給伺服器端判斷，
 * 那裡是權威來源。
 */
async function probeDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'

    const done = (value: number | null) => {
      URL.revokeObjectURL(url)
      video.remove()
      resolve(value)
    }

    video.onloadedmetadata = () => {
      const seconds = video.duration
      done(Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1000) : null)
    }
    video.onerror = () => done(null)
    // 壞掉的檔案可能永遠不觸發任何事件，不能無限等
    setTimeout(() => done(null), 10_000)

    video.src = url
  })
}

async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function Uploader({
  spaceId,
  onUploaded,
}: {
  spaceId: string
  onUploaded: (assetId: string) => void
}) {
  const [uploads, setUploads] = useState<UploadState[]>([])
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const patch = useCallback((id: string, next: Partial<UploadState>) => {
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...next } : u)))
  }, [])

  const uploadOne = useCallback(
    async (file: File) => {
      const id = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

      setUploads((prev) => [
        { id, filename: file.name, bytes: file.size, progress: 0, status: 'hashing' },
        ...prev,
      ])

      // ── 先在前端擋掉明顯不合法的，省一次往返 ──
      if (!ALL_ALLOWED_MIME.includes(file.type)) {
        patch(id, { status: 'failed', message: `不支援 ${file.type || '這個格式'}。` })
        return
      }
      const limit = limitForMime(file.type)
      if (limit !== null && file.size > limit) {
        patch(id, {
          status: 'failed',
          message: `超過 ${Math.round(limit / 1024 / 1024)} MB 上限（這個檔案 ${formatBytes(file.size)}）。`,
        })
        return
      }

      // ADR-019：Alpha 不轉碼，超過 30 秒直接拒絕。
      // 這裡量只是為了**快速回饋** —— 伺服器端會自己解析容器再驗一次，
      // 因為這個值是使用者可以改的（見 packages/validation/src/video-metadata.ts）。
      if (kindForMime(file.type) === 'video') {
        const duration = await probeDuration(file)
        if (duration !== null && duration > LIMITS.videoDurationMs) {
          patch(id, {
            status: 'failed',
            message:
              `影片長 ${Math.round(duration / 1000)} 秒，超過 ` +
              `${LIMITS.videoDurationMs / 1000} 秒上限。目前不會自動裁切。`,
          })
          return
        }
      }

      try {
        const checksum = await sha256Hex(file)

        // ── 1. 取得上傳意圖 ──
        const intentRes = await fetch('/api/assets/upload-intent', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-space-id': spaceId },
          body: JSON.stringify({
            filename: file.name,
            mimeType: file.type,
            bytes: file.size,
            checksum,
          }),
        })

        const intentBody: unknown = await intentRes.json().catch(() => null)
        if (!intentRes.ok) {
          const err = (intentBody as { error?: { message?: string } } | null)?.error
          patch(id, { status: 'failed', message: err?.message ?? '無法開始上傳。' })
          return
        }

        const intent = (intentBody as { data: Record<string, unknown> }).data

        // ── 去重命中：檔案已存在，不用再傳 ──
        if (intent['deduplicated'] === true) {
          const assetId = intent['assetId'] as string
          patch(id, {
            status: 'duplicate',
            progress: 100,
            assetId,
            message: '這個檔案已經在你的空間裡了。',
          })
          onUploaded(assetId)
          return
        }

        const assetId = intent['assetId'] as string
        patch(id, { status: 'uploading', assetId })

        // ── 2. 直傳 R2。用 XHR 而非 fetch，因為 fetch 沒有上傳進度事件。 ──
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          xhr.open('PUT', intent['uploadUrl'] as string)

          for (const [k, v] of Object.entries(intent['headers'] as Record<string, string>)) {
            // Content-Length 由瀏覽器自行設定，手動設會被拒絕
            if (k.toLowerCase() !== 'content-length') xhr.setRequestHeader(k, v)
          }

          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              patch(id, { progress: Math.round((e.loaded / e.total) * 100) })
            }
          })
          xhr.addEventListener('load', () =>
            xhr.status >= 200 && xhr.status < 300
              ? resolve()
              : reject(new Error(`儲存服務回應 ${xhr.status}`)),
          )
          xhr.addEventListener('error', () => reject(new Error('網路中斷')))
          xhr.addEventListener('abort', () => reject(new Error('上傳已取消')))
          xhr.send(file)
        })

        // ── 3. 通知完成，伺服器驗證實際內容 ──
        patch(id, { status: 'processing', progress: 100 })

        const completeRes = await fetch(`/api/assets/${assetId}/complete`, {
          method: 'POST',
          headers: { 'x-space-id': spaceId },
        })
        const completeBody: unknown = await completeRes.json().catch(() => null)

        if (!completeRes.ok) {
          const err = (completeBody as { error?: { message?: string } } | null)?.error
          patch(id, { status: 'failed', message: err?.message ?? '檔案驗證失敗。' })
          return
        }

        patch(id, { status: 'done', message: '完成。' })
        onUploaded(assetId)
      } catch (err) {
        patch(id, {
          status: 'failed',
          message: err instanceof Error ? err.message : '上傳失敗。',
        })
      }
    },
    [spaceId, patch, onUploaded],
  )

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return
      const list = Array.from(files).slice(0, LIMITS.batchFiles)
      if (files.length > LIMITS.batchFiles) {
        // 誠實說明被截斷，而不是靜默只傳前 20 個
        setUploads((prev) => [
          {
            id: `truncated-${Date.now()}`,
            filename: `一次最多 ${LIMITS.batchFiles} 個檔案`,
            bytes: 0,
            progress: 0,
            status: 'failed',
            message: `你選了 ${files.length} 個，只會處理前 ${LIMITS.batchFiles} 個。`,
          },
          ...prev,
        ])
      }
      for (const file of list) void uploadOne(file)
    },
    [uploadOne],
  )

  const active = uploads.filter((u) => u.status !== 'done' && u.status !== 'duplicate')

  return (
    <section className="sr-card">
      <h2 className="sr-section-title">上傳</h2>

      <div
        className={`sr-dropzone${dragging ? ' sr-dropzone-active' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          handleFiles(e.dataTransfer.files)
        }}
      >
        <p style={{ margin: 0 }}>把檔案拖進來，或</p>
        <button
          type="button"
          className="sr-button"
          onClick={() => inputRef.current?.click()}
        >
          選擇檔案
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ALL_ALLOWED_MIME.join(',')}
          style={{ display: 'none' }}
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = ''
          }}
          aria-label="選擇要上傳的檔案"
        />
        <p className="sr-muted" style={{ marginBottom: 0 }}>
          圖片最大 {Math.round(LIMITS.image / 1024 / 1024)} MB、影片{' '}
          {Math.round(LIMITS.video / 1024 / 1024)} MB、PDF{' '}
          {Math.round(LIMITS.pdf / 1024 / 1024)} MB
        </p>
      </div>

      {uploads.length > 0 && (
        <ul className="sr-upload-list" aria-live="polite" aria-busy={active.length > 0}>
          {uploads.map((u) => (
            <li key={u.id} className="sr-upload-item">
              <div className="sr-upload-head">
                <span className="sr-upload-name">{u.filename}</span>
                {u.bytes > 0 && <span className="sr-muted">{formatBytes(u.bytes)}</span>}
              </div>

              {(u.status === 'uploading' || u.status === 'hashing') && (
                <progress
                  className="sr-progress"
                  max={100}
                  value={u.status === 'hashing' ? undefined : u.progress}
                >
                  {u.progress}%
                </progress>
              )}

              <p className="sr-muted" style={{ margin: 0 }}>
                {u.status === 'hashing' && '準備中…'}
                {u.status === 'uploading' && `上傳中 ${u.progress}%`}
                {u.status === 'processing' && '驗證中…'}
                {u.status === 'done' && `✓ ${u.message ?? '完成'}`}
                {u.status === 'duplicate' && `ⓘ ${u.message ?? ''}`}
                {u.status === 'failed' && `✕ ${u.message ?? '失敗'}`}
              </p>

              {u.status === 'failed' && (
                <button
                  type="button"
                  className="sr-button sr-button-secondary"
                  onClick={() => setUploads((prev) => prev.filter((x) => x.id !== u.id))}
                >
                  清除
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
