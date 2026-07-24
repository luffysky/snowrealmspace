import type { NextRequest } from 'next/server'
import { memoryCreateSchema, memoryListQuerySchema } from '@snowrealm/validation'
import { emitEvent } from '@snowrealm/analytics'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

const COLUMNS =
  'id, type, content, source_type, sensitivity, approved, confidence, created_at, updated_at'

export const GET = handler(async (request: NextRequest) => {
  const result = await resolveContext()
  if (!result.ok) {
    if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
    return fail('FORBIDDEN', '你沒有這個空間的存取權。')
  }
  const { ctx } = result

  const parsed = memoryListQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) return failValidation(parsed.error)
  const { status, limit } = parsed.data

  // RLS：memories 僅 owner 可讀。非 owner 這裡查不到任何列。
  let query = ctx.db
    .from('memories')
    .select(COLUMNS)
    .eq('space_id', ctx.spaceId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status === 'approved') query = query.eq('approved', true)
  else if (status === 'pending') query = query.eq('approved', false).is('rejected_at', null)

  const { data, error } = await query
  if (error) {
    console.error('[memories] 查詢失敗', error.message)
    return fail('INTERNAL', '無法載入記憶。')
  }
  return ok(data ?? [])
})

/**
 * 使用者在 Memory Center 主動新增記憶。
 * source_type='user_explicit' + approved=true —— 這是使用者自己說的，不是 Agent 提案。
 * （Agent 提案走 service role，approved=false，見 07-agent.md §5。）
 */
export const POST = handler(async (request: NextRequest) => {
  const result = await resolveContext()
  if (!result.ok) {
    if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
    return fail('FORBIDDEN', '你沒有這個空間的存取權。')
  }
  const { ctx } = result

  const body: unknown = await request.json().catch(() => null)
  const parsed = memoryCreateSchema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)
  const input = parsed.data

  const { data, error } = await ctx.db
    .from('memories')
    .insert({
      space_id: ctx.spaceId,
      created_by: ctx.userId,
      type: input.type,
      content: input.content,
      source_type: 'user_explicit',
      sensitivity: input.sensitivity,
      approved: true,
      confidence: 1,
    })
    .select(COLUMNS)
    .single()

  if (error || !data) {
    console.error('[memories] 建立失敗', error?.message)
    return fail('INTERNAL', '無法新增記憶。')
  }

  await emitEvent('memory.approved', ctx.spaceId, ctx.userId, {
    memoryId: data.id,
    type: data.type,
    sourceType: 'user_explicit',
  }).catch(() => {})
  return ok(data, undefined, 201)
})
