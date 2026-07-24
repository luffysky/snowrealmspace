import { z } from 'zod'

/**
 * Timeline API 的輸入驗證。見 docs/spec/04-api-contract.md §7、03-database.md §9。
 *
 * timeline_events 是 activity_events 的投影，但 title / visibility 使用者可編輯，
 * 且可軟刪除（deleted_at）。授權走 space_id（owner 才能改，見 RLS）。
 */

export const TIMELINE_VIEWS = ['chronological', 'project', 'on_this_day'] as const
export type TimelineView = (typeof TIMELINE_VIEWS)[number]

export const TIMELINE_VISIBILITY = ['private', 'shareable', 'hidden'] as const
export type TimelineVisibility = (typeof TIMELINE_VISIBILITY)[number]

export const timelineListQuerySchema = z
  .object({
    view: z.enum(TIMELINE_VIEWS).default('chronological'),
    projectId: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(100),
  })
  .strict()

export const timelinePatchSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    body: z.string().trim().max(2000).nullable().optional(),
    visibility: z.enum(TIMELINE_VISIBILITY).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: '沒有要更新的欄位' })

export type TimelineListQuery = z.infer<typeof timelineListQuerySchema>
export type TimelinePatchInput = z.infer<typeof timelinePatchSchema>
