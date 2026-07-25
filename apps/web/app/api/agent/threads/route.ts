import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

/** 列出這個空間的對話串（最近在前）。 */
export const GET = handler(async () => {
  const result = await resolveContext()
  if (!result.ok) {
    if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
    return fail('FORBIDDEN', '你沒有這個空間的存取權。')
  }
  const { ctx } = result
  const { data, error } = await ctx.db
    .from('agent_threads')
    .select('id, title, last_message_at')
    .eq('space_id', ctx.spaceId)
    .is('deleted_at', null)
    .order('last_message_at', { ascending: false })
    .limit(100)
  if (error) return fail('INTERNAL', '無法載入對話清單。')
  return ok(data ?? [])
})

const patchSchema = z.object({ threadId: z.string().uuid(), title: z.string().trim().min(1).max(60) }).strict()

/** 重新命名對話。 */
export const PATCH = handler(async (request: NextRequest) => {
  const result = await resolveContext()
  if (!result.ok) return fail(result.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '沒有存取權。')
  const { ctx } = result
  const body: unknown = await request.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)
  const { error } = await ctx.db
    .from('agent_threads')
    .update({ title: parsed.data.title })
    .eq('id', parsed.data.threadId)
    .eq('space_id', ctx.spaceId)
  if (error) return fail('INTERNAL', '改名失敗。')
  return ok({ threadId: parsed.data.threadId, title: parsed.data.title })
})

/** 刪除對話（軟刪除；訊息保留但不再列出）。 */
export const DELETE = handler(async (request: NextRequest) => {
  const result = await resolveContext()
  if (!result.ok) return fail(result.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '沒有存取權。')
  const { ctx } = result
  const id = z.string().uuid().safeParse(new URL(request.url).searchParams.get('threadId'))
  if (!id.success) return fail('VALIDATION_FAILED', 'threadId 不正確。')
  const { error } = await ctx.db
    .from('agent_threads')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id.data)
    .eq('space_id', ctx.spaceId)
  if (error) return fail('INTERNAL', '刪除失敗。')
  return ok({ threadId: id.data, deleted: true })
})
