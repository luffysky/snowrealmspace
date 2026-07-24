import { z } from 'zod'

/**
 * 設計原則 CRUD 的輸入驗證。使用者記錄自己的創作準則。
 */

export const principleCreateSchema = z
  .object({
    title: z.string().trim().min(1, '請輸入原則').max(120),
    body: z.string().trim().max(2000).nullable().optional(),
    category: z.string().trim().max(40).nullable().optional(),
  })
  .strict()

export const principlePatchSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    body: z.string().trim().max(2000).nullable().optional(),
    category: z.string().trim().max(40).nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: '沒有要更新的欄位' })

export const principleReorderSchema = z
  .object({
    orderedIds: z.array(z.string().uuid()).min(1).max(200),
  })
  .strict()

export type PrincipleCreateInput = z.infer<typeof principleCreateSchema>
export type PrinciplePatchInput = z.infer<typeof principlePatchSchema>
export type PrincipleReorderInput = z.infer<typeof principleReorderSchema>
