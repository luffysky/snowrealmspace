import { z } from 'zod'

export const uuidSchema = z.string().uuid()

export const emailSchema = z.string().trim().toLowerCase().email('請輸入有效的 email')

export const slugSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{1,62}$/, 'slug 必須是小寫英數與連字號，長度 2–63')

/** 05-theme-tokens.md §6.2：匯入時只接受純色值，拒絕任何可執行內容。 */
export const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, '必須是 #RRGGBB 格式')

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  cursor: z.string().optional(),
})

export type Pagination = z.infer<typeof paginationSchema>
