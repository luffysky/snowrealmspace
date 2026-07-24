import type { NextRequest } from 'next/server'
import { principleCreateSchema } from '@snowrealm/validation'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

const COLUMNS = 'id, title, body, category, position, created_at, updated_at'

export const GET = handler(async () => {
  const result = await resolveContext()
  if (!result.ok) {
    if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
    return fail('FORBIDDEN', '你沒有這個空間的存取權。')
  }
  const { ctx } = result

  const { data, error } = await ctx.db
    .from('design_principles')
    .select(COLUMNS)
    .eq('space_id', ctx.spaceId)
    .is('deleted_at', null)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[principles] 查詢失敗', error.message)
    return fail('INTERNAL', '無法載入設計原則。')
  }
  return ok(data ?? [])
})

export const POST = handler(async (request: NextRequest) => {
  const result = await resolveContext()
  if (!result.ok) {
    if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
    return fail('FORBIDDEN', '你沒有這個空間的存取權。')
  }
  const { ctx } = result

  const body: unknown = await request.json().catch(() => null)
  const parsed = principleCreateSchema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)
  const input = parsed.data

  // 新的放最後：取目前最大 position + 1
  const { data: last } = await ctx.db
    .from('design_principles')
    .select('position')
    .eq('space_id', ctx.spaceId)
    .is('deleted_at', null)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextPos = (last?.position ?? -1) + 1

  const { data, error } = await ctx.db
    .from('design_principles')
    .insert({
      space_id: ctx.spaceId,
      created_by: ctx.userId,
      title: input.title,
      body: input.body ?? null,
      category: input.category ?? null,
      position: nextPos,
    })
    .select(COLUMNS)
    .single()

  if (error || !data) {
    console.error('[principles] 建立失敗', error?.message)
    return fail('INTERNAL', '無法新增設計原則。')
  }
  return ok(data, undefined, 201)
})
