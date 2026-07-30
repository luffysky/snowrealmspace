import type { NextRequest } from 'next/server'
import { noteCreateSchema } from '@snowrealm/validation'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'
import { sanitizeRichHtml } from '@/lib/rich-html'

export const dynamic = 'force-dynamic'

/** 筆記清單（未刪除、最近在前）。 */
export const GET = handler(async () => {
  const result = await resolveContext()
  if (!result.ok) return fail(result.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '沒有存取權。')
  const { ctx } = result
  const { data, error } = await ctx.db
    .from('notes')
    .select('id, title, body, created_at, updated_at')
    .eq('space_id', ctx.spaceId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(200)
  if (error) return fail('INTERNAL', '載入筆記失敗。')
  return ok(data ?? [])
})

/** 新增一則筆記。 */
export const POST = handler(async (request: NextRequest) => {
  const result = await resolveContext()
  if (!result.ok) return fail(result.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '沒有存取權。')
  const { ctx } = result
  const body: unknown = await request.json().catch(() => null)
  const parsed = noteCreateSchema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)

  // 指定專案時，確認該專案屬於這個 space（避免掛到別的 space 的專案）
  if (parsed.data.projectId) {
    const { data: proj } = await ctx.db
      .from('projects')
      .select('id')
      .eq('id', parsed.data.projectId)
      .eq('space_id', ctx.spaceId)
      .maybeSingle()
    if (!proj) return fail('NOT_FOUND', '找不到這個專案。')
  }

  const { data, error } = await ctx.db
    .from('notes')
    .insert({
      space_id: ctx.spaceId,
      created_by: ctx.userId,
      title: parsed.data.title ?? null,
      body: sanitizeRichHtml(parsed.data.body),
      project_id: parsed.data.projectId ?? null,
    })
    .select('id, title, body, project_id, created_at, updated_at')
    .single()
  if (error || !data) return fail('INTERNAL', '新增筆記失敗。')
  return ok(data)
})
