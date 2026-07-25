import type { NextRequest } from 'next/server'
import { goalPatchSchema } from '@snowrealm/validation'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

/** 更新目標（進度／完成／改名）。done 由前端或「current>=target」判定。 */
export const PATCH = handler(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const result = await resolveContext()
  if (!result.ok) return fail(result.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '沒有存取權。')
  const { ctx } = result
  const { id } = await params
  const body: unknown = await request.json().catch(() => null)
  const parsed = goalPatchSchema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)

  // exactOptionalPropertyTypes：只放有值的欄位，不帶 undefined
  const patch: { title?: string; target?: number; current?: number; done?: boolean } = {}
  if (parsed.data.title !== undefined) patch.title = parsed.data.title
  if (parsed.data.target !== undefined) patch.target = parsed.data.target
  if (parsed.data.current !== undefined) patch.current = parsed.data.current
  if (parsed.data.done !== undefined) patch.done = parsed.data.done

  const { data, error } = await ctx.db
    .from('goals')
    .update(patch)
    .eq('id', id)
    .eq('space_id', ctx.spaceId)
    .is('deleted_at', null)
    .select('id, title, target, current, unit, done, created_at')
    .maybeSingle()
  if (error) return fail('INTERNAL', '更新目標失敗。')
  if (!data) return fail('NOT_FOUND', '找不到這個目標。')
  return ok(data)
})

/** 刪除目標（軟刪除）。 */
export const DELETE = handler(async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const result = await resolveContext()
  if (!result.ok) return fail(result.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '沒有存取權。')
  const { ctx } = result
  const { id } = await params
  const { error } = await ctx.db
    .from('goals')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('space_id', ctx.spaceId)
  if (error) return fail('INTERNAL', '刪除目標失敗。')
  return ok({ id, deleted: true })
})
