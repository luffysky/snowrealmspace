import type { NextRequest } from 'next/server'
import { goalCreateSchema } from '@snowrealm/validation'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

/** 目標清單（未刪除，最近在前）。 */
export const GET = handler(async () => {
  const result = await resolveContext()
  if (!result.ok) return fail(result.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '沒有存取權。')
  const { ctx } = result
  const { data, error } = await ctx.db
    .from('goals')
    .select('id, title, target, current, unit, done, created_at')
    .eq('space_id', ctx.spaceId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return fail('INTERNAL', '載入目標失敗。')
  return ok(data ?? [])
})

/** 建立目標。 */
export const POST = handler(async (request: NextRequest) => {
  const result = await resolveContext()
  if (!result.ok) return fail(result.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '沒有存取權。')
  const { ctx } = result
  const body: unknown = await request.json().catch(() => null)
  const parsed = goalCreateSchema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)

  const { data, error } = await ctx.db
    .from('goals')
    .insert({
      space_id: ctx.spaceId,
      title: parsed.data.title,
      target: parsed.data.target,
      unit: parsed.data.unit,
      created_by: ctx.userId,
    })
    .select('id, title, target, current, unit, done, created_at')
    .single()
  if (error || !data) return fail('INTERNAL', '建立目標失敗。')
  return ok(data)
})
