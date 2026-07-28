import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

const query = z.object({ fileId: z.string().uuid() })

/**
 * 找「這件作品」既有的對話串。綁定方式：agent_messages.context_refs.designFileId
 * （複用既有 jsonb 欄位，不需 migration）。回傳最近一則帶此標記訊息所屬的 thread_id。
 * member RLS 唯讀 —— 不是成員查不到。
 */
export const GET = handler(async (request: NextRequest) => {
  const result = await resolveContext()
  if (!result.ok) return fail(result.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '沒有存取權。')
  const { ctx } = result

  const parsed = query.safeParse({ fileId: request.nextUrl.searchParams.get('fileId') })
  if (!parsed.success) return failValidation(parsed.error)

  const { data: row } = await ctx.db
    .from('agent_messages')
    .select('thread_id')
    .eq('space_id', ctx.spaceId)
    .filter('context_refs->>designFileId', 'eq', parsed.data.fileId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ thread_id: string }>()

  return ok({ threadId: row?.thread_id ?? null })
})
