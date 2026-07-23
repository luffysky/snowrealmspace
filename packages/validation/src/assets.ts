import { z } from 'zod'

/**
 * 上傳相關的 schema。見 docs/spec/04-api-contract.md §2。
 *
 * MIME 白名單與大小上限在這裡是**唯一定義處** ——
 * API 層與 worker 都引用同一份，避免兩邊各自維護而漂移。
 */

export const ALLOWED_MIME = {
  image: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'],
  video: ['video/mp4', 'video/webm'],
  pdf: ['application/pdf'],
} as const

export const ALL_ALLOWED_MIME: readonly string[] = [
  ...ALLOWED_MIME.image,
  ...ALLOWED_MIME.video,
  ...ALLOWED_MIME.pdf,
]

/** ADR-022 的配額。 */
export const LIMITS = {
  image: 25 * 1024 * 1024,
  video: 20 * 1024 * 1024,
  pdf: 50 * 1024 * 1024,
  spaceTotal: 5 * 1024 * 1024 * 1024,
  batchFiles: 20,
  /** ADR-019：Alpha 不轉碼，超過就拒絕 */
  videoDurationMs: 30_000,
} as const

export type AssetKind = 'image' | 'video' | 'pdf' | 'audio' | 'font' | 'document'

export function kindForMime(mime: string): AssetKind | null {
  if ((ALLOWED_MIME.image as readonly string[]).includes(mime)) return 'image'
  if ((ALLOWED_MIME.video as readonly string[]).includes(mime)) return 'video'
  if ((ALLOWED_MIME.pdf as readonly string[]).includes(mime)) return 'pdf'
  return null
}

export function limitForMime(mime: string): number | null {
  const kind = kindForMime(mime)
  if (!kind) return null
  if (kind === 'image') return LIMITS.image
  if (kind === 'video') return LIMITS.video
  if (kind === 'pdf') return LIMITS.pdf
  return null
}

export const uploadIntentSchema = z
  .object({
    filename: z.string().min(1).max(255),
    mimeType: z
      .string()
      .max(120)
      .refine((m) => ALL_ALLOWED_MIME.includes(m), {
        message: '不支援的檔案類型',
      }),
    bytes: z.number().int().positive(),
    /** SHA-256 hex，客戶端算好用於去重 */
    checksum: z.string().regex(/^[a-f0-9]{64}$/, 'checksum 必須是 SHA-256 hex'),
  })
  .strict()
  .superRefine((val, ctx) => {
    const limit = limitForMime(val.mimeType)
    if (limit !== null && val.bytes > limit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['bytes'],
        message: `檔案超過 ${Math.round(limit / 1024 / 1024)} MB 上限`,
      })
    }
  })

export type UploadIntentInput = z.infer<typeof uploadIntentSchema>

export const assetListQuerySchema = z
  .object({
    kind: z.enum(['image', 'video', 'pdf', 'audio', 'font', 'document']).optional(),
    q: z.string().max(120).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(30),
    cursor: z.string().optional(),
  })
  .strict()

export const assetPatchSchema = z
  .object({
    originalFilename: z.string().min(1).max(255),
  })
  .strict()

/**
 * 檔案內容的 magic bytes 偵測。
 *
 * 為什麼不能信任 client 宣稱的 MIME：那是使用者可以任意填的字串。
 * 把 .exe 改名成 .png 再宣稱 image/png 是最基本的攻擊。
 */
export function sniffMimeType(head: Uint8Array): string | null {
  const b = head
  const startsWith = (...sig: number[]) => sig.every((v, i) => b[i] === v)

  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png'
  if (startsWith(0xff, 0xd8, 0xff)) return 'image/jpeg'
  if (startsWith(0x47, 0x49, 0x46, 0x38)) return 'image/gif'
  if (startsWith(0x25, 0x50, 0x44, 0x46)) return 'application/pdf'

  // RIFF....WEBP
  if (
    startsWith(0x52, 0x49, 0x46, 0x46) &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  ) {
    return 'image/webp'
  }

  // ISO-BMFF：....ftyp
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const brand = String.fromCharCode(b[8] ?? 0, b[9] ?? 0, b[10] ?? 0, b[11] ?? 0)
    if (brand.startsWith('avif') || brand.startsWith('avis')) return 'image/avif'
    return 'video/mp4'
  }

  // EBML（WebM / Matroska）
  if (startsWith(0x1a, 0x45, 0xdf, 0xa3)) return 'video/webm'

  return null
}

/**
 * 宣稱的 MIME 與實際內容是否相符。
 * jpeg 有兩種常見寫法，其餘要求完全一致。
 */
export function mimeMatches(claimed: string, sniffed: string): boolean {
  if (claimed === sniffed) return true
  const jpeg = new Set(['image/jpeg', 'image/jpg'])
  return jpeg.has(claimed) && jpeg.has(sniffed)
}
