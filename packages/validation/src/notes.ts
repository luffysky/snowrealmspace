import { z } from 'zod'

/** 筆記 CRUD（notes 表）。隨手記從單格擴充成可增刪改查的筆記。 */

export const noteCreateSchema = z
  .object({
    title: z.string().trim().max(120).nullable().optional(),
    body: z.string().trim().min(1, '請輸入內容').max(10000),
  })
  .strict()

export const notePatchSchema = z
  .object({
    title: z.string().trim().max(120).nullable().optional(),
    body: z.string().trim().min(1).max(10000).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: '沒有要更新的欄位' })

export type NoteCreateInput = z.infer<typeof noteCreateSchema>
export type NotePatchInput = z.infer<typeof notePatchSchema>
