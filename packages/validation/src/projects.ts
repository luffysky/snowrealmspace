import { z } from 'zod'

/**
 * Project API 的輸入驗證。見 docs/spec/04-api-contract.md §6、03-database.md §7。
 *
 * project 是「創作專案」這個組織單元：名稱、狀態、封面、標籤。
 * 授權一律走 space_id（X-Space-Id header），這裡不接受任何 space 相關欄位。
 */

export const PROJECT_STATUSES = ['idea', 'active', 'paused', 'completed', 'archived'] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

/** 標籤：小寫、修剪、去空與去重、上限 20 個、每個 ≤ 30 字。 */
const tagsSchema = z
  .array(z.string().trim().min(1).max(30))
  .max(20)
  .transform((tags) => Array.from(new Set(tags.map((t) => t.toLowerCase()))))

export const projectCreateSchema = z
  .object({
    name: z.string().trim().min(1, '請輸入專案名稱').max(80),
    description: z.string().trim().max(2000).nullable().optional(),
    status: z.enum(PROJECT_STATUSES).default('idea'),
    coverAssetId: z.string().uuid().nullable().optional(),
    tags: tagsSchema.optional(),
  })
  .strict()

export const projectPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    status: z.enum(PROJECT_STATUSES).optional(),
    coverAssetId: z.string().uuid().nullable().optional(),
    tags: tagsSchema.optional(),
  })
  .strict()
  // 至少要改一個欄位，否則是無意義請求
  .refine((v) => Object.keys(v).length > 0, { message: '沒有要更新的欄位' })

export const projectListQuerySchema = z
  .object({
    status: z.enum(PROJECT_STATUSES).optional(),
    tag: z.string().trim().min(1).max(30).toLowerCase().optional(),
    q: z.string().trim().min(1).max(80).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(60),
  })
  .strict()

export type ProjectCreateInput = z.infer<typeof projectCreateSchema>
export type ProjectPatchInput = z.infer<typeof projectPatchSchema>
export type ProjectListQuery = z.infer<typeof projectListQuerySchema>
