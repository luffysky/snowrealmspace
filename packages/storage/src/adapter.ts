/**
 * StorageAdapter —— feature code 唯一能碰儲存層的介面。
 *
 * ADR-002：禁止在 feature code 直接呼叫 S3 SDK。
 * 這讓「R2 換成別的物件儲存」只需要新增一個實作。
 */

export type PutIntent = {
  key: string
  contentType: string
  contentLength: number
  /** 上傳者必須送出的 header。客戶端 PUT 時要原樣帶上，否則 signature 不符。 */
  requiredHeaders: Record<string, string>
  url: string
  expiresAt: Date
}

export type ObjectHead = {
  key: string
  bytes: number
  contentType: string | null
  etag: string | null
  lastModified: Date | null
}

export interface StorageAdapter {
  /** 產生單次使用的上傳 URL（ADR-022：10 分鐘）。 */
  createUploadUrl(input: {
    key: string
    contentType: string
    contentLength: number
    expiresInSeconds?: number
  }): Promise<PutIntent>

  /** 產生短期讀取 URL（ADR-022：15 分鐘）。 */
  createDownloadUrl(input: { key: string; expiresInSeconds?: number }): Promise<string>

  /** 讀取物件 metadata。用於驗證客戶端上傳的內容與宣稱相符。 */
  head(key: string): Promise<ObjectHead | null>

  /** 讀取物件內容。worker 產生縮圖 / 偵測 MIME 時使用。 */
  get(key: string): Promise<Uint8Array>

  /**
   * 直接上傳（worker 寫入衍生檔、字體分片上傳時使用，不經過 signed URL）。
   *
   * `cacheControl` 只給**內容不會變**的物件用（檔名含雜湊或版本）。
   * 使用者上傳的檔案不要設 immutable —— 那會讓刪除後的舊內容
   * 留在 CDN 與瀏覽器快取裡一年。
   */
  put(input: {
    key: string
    body: Uint8Array
    contentType: string
    cacheControl?: string
  }): Promise<void>

  /** 刪除單一物件。刪除不存在的 key 不算錯誤（冪等）。 */
  delete(key: string): Promise<void>

  /** 批次刪除。回傳實際刪除失敗的 key。 */
  deleteMany(keys: string[]): Promise<{ failed: string[] }>

  /** 列出前綴下的物件。GC 掃孤兒檔案時使用。 */
  list(prefix: string, limit?: number): Promise<string[]>
}

/**
 * R2 物件鍵。見 v1.0 §38.2。
 * 集中在此避免各處手拼字串導致路徑不一致。
 */
export const storageKeys = {
  assetOriginal: (userId: string, spaceId: string, assetId: string) =>
    `users/${userId}/spaces/${spaceId}/assets/${assetId}/original`,

  assetRendition: (userId: string, spaceId: string, assetId: string, role: string) =>
    `users/${userId}/spaces/${spaceId}/assets/${assetId}/${role}`,

  providerExport: (provider: string, connectionId: string, fileId: string, snapshotId: string) =>
    `providers/${provider}/${connectionId}/${fileId}/${snapshotId}`,

  font: (fontId: string, weight: string, subset: string) =>
    `fonts/${fontId}/${weight}/${subset}.woff2`,

  spacePrefix: (userId: string, spaceId: string) => `users/${userId}/spaces/${spaceId}/`,
} as const
