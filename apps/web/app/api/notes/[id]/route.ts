import type { NextRequest } from 'next/server'
import { notePatchSchema } from '@snowrealm/validation'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'
import { sanitizeRichHtml } from '@/lib/rich-html'

export const dynamic = 'force-dynamic'

/** 編輯筆記。 */
export const PATCH = handler(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const result = await resolveContext()
  if (!result.ok) return fail(result.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '沒有存取權。')
  const { ctx } = result
  const { id } = await params
  const body: unknown = await request.json().catch(() => null)
  const parsed = notePatchSchema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)

  const patch: { title?: string | null; body?: string } = {}
  if (parsed.data.title !== undefined) patch.title = parsed.data.title
  if (parsed.data.body !== undefined) patch.body = sanitizeRichHtml(parsed.data.body)

  const { data, error } = await ctx.db
    .from('notes')
    .update(patch)
    .eq('id', id)
    .eq('space_id', ctx.spaceId)
    .is('deleted_at', null)
    .select('id, title, body, created_at, updated_at')
    .maybeSingle()
  if (error) return fail('INTERNAL', '更新筆記失敗。')
  if (!data) return fail('NOT_FOUND', '找不到這則筆記。')
  return ok(data)
})

/** 刪除筆記（軟刪除）。 */
export const DELETE = handler(async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const result = await resolveContext()
  if (!result.ok) return fail(result.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '沒有存取權。')
  const { ctx } = result
  const { id } = await params
  const { error } = await ctx.db
    .from('notes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('space_id', ctx.spaceId)
  if (error) return fail('INTERNAL', '刪除筆記失敗。')
  return ok({ id, deleted: true })
})
