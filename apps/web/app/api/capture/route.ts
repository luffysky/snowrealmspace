import type { NextRequest } from 'next/server'
import { captureCreateSchema } from '@snowrealm/validation'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

/** inbox 清單（未處理的最近在前）。 */
export const GET = handler(async () => {
  const result = await resolveContext()
  if (!result.ok) return fail(result.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '沒有存取權。')
  const { ctx } = result
  const { data, error } = await ctx.db
    .from('capture_inbox')
    .select('id, body, source, status, created_at')
    .eq('space_id', ctx.spaceId)
    .eq('status', 'inbox')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) return fail('INTERNAL', '載入 inbox 失敗。')
  return ok(data ?? [])
})

/** 丟一個念頭進 inbox。source 之後可由 YukiBoard/agent 帶入。 */
export const POST = handler(async (request: NextRequest) => {
  const result = await resolveContext()
  if (!result.ok) return fail(result.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '沒有存取權。')
  const { ctx } = result
  const body: unknown = await request.json().catch(() => null)
  const parsed = captureCreateSchema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)

  const { data, error } = await ctx.db
    .from('capture_inbox')
    .insert({
      space_id: ctx.spaceId,
      body: parsed.data.body,
      source: parsed.data.source,
      created_by: ctx.userId,
    })
    .select('id, body, source, status, created_at')
    .single()
  if (error || !data) return fail('INTERNAL', '存不了，請再試一次。')
  return ok(data)
})
