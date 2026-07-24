import { z } from 'zod'

/**
 * Design file / snapshot API 的輸入驗證。
 * 見 docs/spec/04-api-contract.md §6、02-domain-model.md §3.3–3.4。
 *
 * design_file 是「作品」這個創作單元（不存位元組）；design_snapshot 是它的某個版本，
 * 用 asset_id 指向該版本的畫面。上傳作品 = 建 design_file + 第一筆 snapshot。
 */

const tagsSchema = z
  .array(z.string().trim().min(1).max(30))
  .max(20)
  .transform((tags) => Array.from(new Set(tags.map((t) => t.toLowerCase()))))

export const designFileCreateSchema = z
  .object({
    assetId: z.string().uuid(),
    title: z.string().trim().min(1, '請輸入作品標題').max(120),
    description: z.string().trim().max(2000).nullable().optional(),
    projectId: z.string().uuid().nullable().optional(),
    tags: tagsSchema.optional(),
  })
  .strict()

export const designFilePatchSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    projectId: z.string().uuid().nullable().optional(),
    tags: tagsSchema.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: '沒有要更新的欄位' })

export const designFileListQuerySchema = z
  .object({
    projectId: z.string().uuid().optional(),
    tag: z.string().trim().min(1).max(30).toLowerCase().optional(),
    q: z.string().trim().min(1).max(120).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(60),
  })
  .strict()

/** 上傳新版本：帶新的 assetId（畫面），系統建一筆新 snapshot。 */
export const snapshotCreateSchema = z
  .object({
    assetId: z.string().uuid(),
    externalVersionId: z.string().max(200).optional(),
  })
  .strict()

/** 比較兩個版本（同一作品或跨作品皆可），回傳本地計算的數值差異。 */
export const snapshotCompareSchema = z
  .object({
    a: z.string().uuid(),
    b: z.string().uuid(),
  })
  .strict()
  .refine((v) => v.a !== v.b, { message: '請選兩個不同的版本' })

export type DesignFileCreateInput = z.infer<typeof designFileCreateSchema>
export type DesignFilePatchInput = z.infer<typeof designFilePatchSchema>
export type DesignFileListQuery = z.infer<typeof designFileListQuerySchema>
export type SnapshotCreateInput = z.infer<typeof snapshotCreateSchema>
export type SnapshotCompareInput = z.infer<typeof snapshotCompareSchema>
