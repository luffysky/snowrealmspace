import type { NextRequest } from 'next/server'
import { timelinePatchSchema, type TimelineVisibility } from '@snowrealm/validation'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

const COLUMNS = 'id, event_type, title, body, cover_asset_id, project_id, visibility, occurred_at'

/**
 * 編輯 timeline 的標題 / 內文 / 可見性。
 * RLS：只有 owner 能改（owner manages timeline policy）。
 */
export const PATCH = handler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const result = await resolveContext()
    if (!result.ok) {
      if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
      return fail('FORBIDDEN', '你沒有這個空間的存取權。')
    }
    const { ctx } = result
    const { id } = await params

    const body: unknown = await request.json().catch(() => null)
    const parsed = timelinePatchSchema.safeParse(body)
    if (!parsed.success) return failValidation(parsed.error)
    const input = parsed.data

    type Update = { title?: string; body?: string | null; visibility?: TimelineVisibility }
    const patch: Update = {}
    if (input.title !== undefined) patch.title = input.title
    if (input.body !== undefined) patch.body = input.body
    if (input.visibility !== undefined) patch.visibility = input.visibility

    const { data, error } = await ctx.db
      .from('timeline_events')
      .update(patch)
      .eq('id', id)
      .eq('space_id', ctx.spaceId)
      .is('deleted_at', null)
      .select(COLUMNS)
      .maybeSingle()

    if (error) {
      // owner 以外的成員會被 RLS 擋（update 0 列）→ 這裡回 NOT_FOUND 而非洩漏權限細節
      console.error('[timeline] 更新失敗', error.message)
      return fail('INTERNAL', '無法更新。')
    }
    if (!data) return fail('NOT_FOUND', '找不到這筆時間軸，或你沒有編輯權限。')
    return ok(data)
  },
)

/** 軟刪除。owner 專屬。 */
export const DELETE = handler(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const result = await resolveContext()
    if (!result.ok) {
      if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
      return fail('FORBIDDEN', '你沒有這個空間的存取權。')
    }
    const { ctx } = result
    const { id } = await params

    const { data, error } = await ctx.db
      .from('timeline_events')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('space_id', ctx.spaceId)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle()

    if (error) return fail('INTERNAL', '無法刪除。')
    if (!data) return fail('NOT_FOUND', '找不到這筆時間軸，或你沒有刪除權限。')
    return ok({ id: data.id, deleted: true })
  },
)
