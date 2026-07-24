import { z } from 'zod'

/**
 * 上傳相關的 schema。見 docs/spec/04-api-contract.md §2。
 *
 * MIME 白名單與大小上限在這裡是**唯一定義處** ——
 * API 層與 worker 都引用同一份，避免兩邊各自維護而漂移。
 */

export const ALLOWED_MIME = {
  image: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'],
  // 瀏覽器原生可播的容器；quicktime(.mov) 多數桌機瀏覽器可播 H.264。
  video: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'],
  // 背景音樂用。mpeg=.mp3、mp4=.m4a
  audio: ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/mp4'],
  pdf: ['application/pdf'],
} as const

export const ALL_ALLOWED_MIME: readonly string[] = [
  ...ALLOWED_MIME.image,
  ...ALLOWED_MIME.video,
  ...ALLOWED_MIME.audio,
  ...ALLOWED_MIME.pdf,
]

/**
 * 配額。ADR-022 偏離（Luffy 指示）：單檔上限拉到 500MB，讓背景影片能用。
 * 背景影片不轉碼、直接播，所以不再有時長硬限。space 總量仍 5GB。
 */
export const LIMITS = {
  image: 25 * 1024 * 1024,
  video: 500 * 1024 * 1024,
  audio: 500 * 1024 * 1024,
  pdf: 50 * 1024 * 1024,
  spaceTotal: 5 * 1024 * 1024 * 1024,
  batchFiles: 20,
} as const

export type AssetKind = 'image' | 'video' | 'pdf' | 'audio' | 'font' | 'document'

export function kindForMime(mime: string): AssetKind | null {
  if ((ALLOWED_MIME.image as readonly string[]).includes(mime)) return 'image'
  if ((ALLOWED_MIME.video as readonly string[]).includes(mime)) return 'video'
  if ((ALLOWED_MIME.audio as readonly string[]).includes(mime)) return 'audio'
  if ((ALLOWED_MIME.pdf as readonly string[]).includes(mime)) return 'pdf'
  return null
}

export function limitForMime(mime: string): number | null {
  const kind = kindForMime(mime)
  if (!kind) return null
  if (kind === 'image') return LIMITS.image
  if (kind === 'video') return LIMITS.video
  if (kind === 'audio') return LIMITS.audio
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
    /** 標籤過濾（單一標籤，小寫）。 */
    tag: z.string().trim().min(1).max(30).toLowerCase().optional(),
    /** 只看收藏。 */
    favorite: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
    /** 封存的顯示策略：預設排除、only 只看封存、include 全都看。 */
    archived: z.enum(['exclude', 'only', 'include']).default('exclude'),
    /** 依專案過濾（透過 design_files 連結；C4 起生效）。 */
    projectId: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(30),
    cursor: z.string().optional(),
  })
  .strict()

/** 整理用 metadata 更新。位元組事實不可改（ADR-005），只改顯示與整理欄位。 */
export const assetPatchSchema = z
  .object({
    originalFilename: z.string().trim().min(1).max(255).optional(),
    isFavorite: z.boolean().optional(),
    /** true = 封存、false = 取消封存 */
    archived: z.boolean().optional(),
    tags: z
      .array(z.string().trim().min(1).max(30))
      .max(20)
      .transform((tags) => Array.from(new Set(tags.map((t) => t.toLowerCase()))))
      .optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: '沒有要更新的欄位' })

export type AssetListQuery = z.infer<typeof assetListQuerySchema>
export type AssetPatchInput = z.infer<typeof assetPatchSchema>

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

  // RIFF：WEBP（圖片）或 WAVE（音訊）—— 同樣 RIFF 容器，看第 8~11 byte 區分
  if (startsWith(0x52, 0x49, 0x46, 0x46)) {
    if (b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp'
    if (b[8] === 0x57 && b[9] === 0x41 && b[10] === 0x56 && b[11] === 0x45) return 'audio/wav'
  }

  // MP3：ID3 標籤，或 MPEG frame sync（0xFFEx/0xFFFx）
  if (startsWith(0x49, 0x44, 0x33)) return 'audio/mpeg'
  if (b[0] === 0xff && ((b[1] ?? 0) & 0xe0) === 0xe0) return 'audio/mpeg'

  // Ogg 容器（可能承載音訊或視訊；magic bytes 分不出，交給 mimeMatches 家族等價）
  if (startsWith(0x4f, 0x67, 0x67, 0x53)) return 'audio/ogg'

  // ISO-BMFF：....ftyp。brand 分辨 avif（圖）/ m4a（音）/ 其餘當 mp4（視訊容器）
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const brand = String.fromCharCode(b[8] ?? 0, b[9] ?? 0, b[10] ?? 0, b[11] ?? 0)
    if (brand.startsWith('avif') || brand.startsWith('avis')) return 'image/avif'
    if (brand.startsWith('M4A') || brand.startsWith('M4B')) return 'audio/mp4'
    return 'video/mp4'
  }

  // EBML（WebM / Matroska）—— 同樣分不出音訊/視訊，交給 mimeMatches 家族等價
  if (startsWith(0x1a, 0x45, 0xdf, 0xa3)) return 'video/webm'

  return null
}

/**
 * 宣稱的 MIME 與實際內容是否相符。
 * jpeg 有兩種常見寫法，其餘要求完全一致。
 */
export function mimeMatches(claimed: string, sniffed: string): boolean {
  if (claimed === sniffed) return true
  // magic bytes 只認得「容器」，認不出同容器裡是音訊還是視訊。
  // 同容器家族視為相符，由 client 宣稱的 audio/video 標示為準。
  const families: Set<string>[] = [
    new Set(['image/jpeg', 'image/jpg']),
    new Set(['video/mp4', 'audio/mp4']), // ISO-BMFF
    new Set(['video/webm', 'audio/webm']), // EBML
    new Set(['video/ogg', 'audio/ogg']), // Ogg
  ]
  return families.some((f) => f.has(claimed) && f.has(sniffed))
}
