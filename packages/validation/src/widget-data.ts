import { z } from 'zod'

/** mood_checkin / goal_tracker widget 的資料輸入 schema。 */

export const MOODS = ['great', 'good', 'ok', 'low', 'rough'] as const
export type Mood = (typeof MOODS)[number]

export const moodUpsertSchema = z
  .object({
    mood: z.enum(MOODS),
    note: z.string().trim().max(280).default(''),
  })
  .strict()

export const goalCreateSchema = z
  .object({
    title: z.string().trim().min(1, '請輸入目標').max(80),
    target: z.number().int().min(1).max(1_000_000).default(1),
    unit: z.string().trim().max(20).default(''),
  })
  .strict()

export const goalPatchSchema = z
  .object({
    title: z.string().trim().min(1).max(80).optional(),
    target: z.number().int().min(1).max(1_000_000).optional(),
    current: z.number().int().min(0).max(1_000_000).optional(),
    done: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: '沒有要更新的欄位' })

export type MoodUpsertInput = z.infer<typeof moodUpsertSchema>
export type GoalCreateInput = z.infer<typeof goalCreateSchema>
export type GoalPatchInput = z.infer<typeof goalPatchSchema>
