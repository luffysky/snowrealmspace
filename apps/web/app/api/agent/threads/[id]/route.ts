import type { NextRequest } from 'next/server'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

/** 載入某個對話串的訊息（切換對話時用）。 */
export const GET = handler(async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const result = await resolveContext()
  if (!result.ok) {
    if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
    return fail('FORBIDDEN', '你沒有這個空間的存取權。')
  }
  const { ctx } = result
  const { id } = await params

  const { data: thread } = await ctx.db
    .from('agent_threads')
    .select('id, title')
    .eq('id', id)
    .eq('space_id', ctx.spaceId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!thread) return fail('NOT_FOUND', '找不到這個對話。')

  const { data: msgs } = await ctx.db
    .from('agent_messages')
    .select('id, role, content, escalated')
    .eq('thread_id', id)
    .order('created_at', { ascending: true })
    .limit(200)

  const messages = (msgs ?? [])
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ id: m.id, role: m.role as 'user' | 'assistant', content: m.content ?? '', escalated: m.escalated ?? false }))

  return ok({ threadId: thread.id, title: thread.title, messages })
})
