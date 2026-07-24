import type { NextRequest } from 'next/server'
import { timelineListQuerySchema } from '@snowrealm/validation'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

const COLUMNS =
  'id, event_type, title, body, cover_asset_id, project_id, visibility, occurred_at, created_at'

export const GET = handler(async (request: NextRequest) => {
  const result = await resolveContext()
  if (!result.ok) {
    if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
    return fail('FORBIDDEN', '你沒有這個空間的存取權。')
  }
  const { ctx } = result

  const parsed = timelineListQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  )
  if (!parsed.success) return failValidation(parsed.error)
  const { view, projectId, limit } = parsed.data

  // on_this_day 需要跨年份比對月日，先多抓一些再於 JS 過濾。
  const fetchLimit = view === 'on_this_day' ? 500 : limit

  let query = ctx.db
    .from('timeline_events')
    .select(COLUMNS)
    .eq('space_id', ctx.spaceId)
    .is('deleted_at', null)
    .order('occurred_at', { ascending: false })
    .limit(fetchLimit)

  if (projectId) query = query.eq('project_id', projectId)

  const { data, error } = await query
  if (error) {
    console.error('[timeline] 查詢失敗', error.message)
    return fail('INTERNAL', '無法載入時間軸。')
  }

  let rows = data ?? []

  if (view === 'on_this_day') {
    const today = new Date()
    const m = today.getMonth()
    const d = today.getDate()
    rows = rows
      .filter((r) => {
        const t = new Date(r.occurred_at)
        return t.getMonth() === m && t.getDate() === d
      })
      .slice(0, limit)
  }

  return ok(rows, { view })
})
