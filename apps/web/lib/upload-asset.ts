/**
 * 單檔上傳 helper（三段流程，02-domain-model.md §5.1）。
 * 從 Library 的 Uploader 抽出，讓 Agent 附件也能複用同一條 ADR-005 管線
 * —— 位元組只進 assets，不另開後門。
 */

async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * 上傳一個檔案，回傳 assetId（去重命中時回既有 asset）。
 * 失敗時 throw Error（訊息可直接顯示給使用者）。
 */
export async function uploadAsset(file: File, spaceId: string): Promise<string> {
  const checksum = await sha256Hex(file)

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
    throw new Error(err?.message ?? '無法開始上傳。')
  }
  const intent = (intentBody as { data: Record<string, unknown> }).data
  const assetId = intent['assetId'] as string

  // 去重命中：檔案已存在，直接用
  if (intent['deduplicated'] === true) return assetId

  // 直傳 R2
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', intent['uploadUrl'] as string)
    for (const [k, v] of Object.entries(intent['headers'] as Record<string, string>)) {
      if (k.toLowerCase() !== 'content-length') xhr.setRequestHeader(k, v)
    }
    xhr.addEventListener('load', () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`儲存服務回應 ${xhr.status}`)),
    )
    xhr.addEventListener('error', () => reject(new Error('網路中斷')))
    xhr.addEventListener('abort', () => reject(new Error('上傳已取消')))
    xhr.send(file)
  })

  // 通知完成，伺服器驗證實際內容
  const completeRes = await fetch(`/api/assets/${assetId}/complete`, {
    method: 'POST',
    headers: { 'x-space-id': spaceId },
  })
  const completeBody: unknown = await completeRes.json().catch(() => null)
  if (!completeRes.ok) {
    const err = (completeBody as { error?: { message?: string } } | null)?.error
    throw new Error(err?.message ?? '檔案驗證失敗。')
  }
  return assetId
}
