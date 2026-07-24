import { z } from 'zod'

/**
 * 記憶 API 的輸入驗證。見 docs/spec/07-agent.md §5、03-database.md §8。
 *
 * ADR-014：記憶預設關閉；Agent 產生的記憶不得直接 approved（DB constraint + API 雙重）。
 * sensitivity='restricted' 的記憶永不進入 Agent context（只在 Memory Center 顯示）。
 */

export const MEMORY_SENSITIVITY = ['normal', 'private', 'restricted'] as const
export type MemorySensitivity = (typeof MEMORY_SENSITIVITY)[number]

/** 使用者在 Memory Center 主動新增的記憶（source_type=user_explicit、直接 approved）。 */
export const memoryCreateSchema = z
  .object({
    content: z.string().trim().min(1, '請輸入內容').max(1000),
    type: z.string().trim().min(1).max(40).default('note'),
    sensitivity: z.enum(MEMORY_SENSITIVITY).default('normal'),
  })
  .strict()

export const memoryPatchSchema = z
  .object({
    content: z.string().trim().min(1).max(1000).optional(),
    sensitivity: z.enum(MEMORY_SENSITIVITY).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: '沒有要更新的欄位' })

export const memoryListQuerySchema = z
  .object({
    status: z.enum(['approved', 'pending', 'all']).default('approved'),
    limit: z.coerce.number().int().min(1).max(200).default(100),
  })
  .strict()

export type MemoryCreateInput = z.infer<typeof memoryCreateSchema>
export type MemoryPatchInput = z.infer<typeof memoryPatchSchema>
export type MemoryListQuery = z.infer<typeof memoryListQuerySchema>
