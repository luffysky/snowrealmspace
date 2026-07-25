import type { NextRequest } from 'next/server'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

/** agent_messages.blocks（jsonb）→ 圖片附件參照。忽略非圖片 block。 */
function blocksToAttachments(
  blocks: unknown,
): { assetId: string; mimeType: string }[] | undefined {
  if (!Array.isArray(blocks)) return undefined
  const out: { assetId: string; mimeType: string }[] = []
  for (const b of blocks) {
    if (b && typeof b === 'object' && (b as { type?: string }).type === 'image') {
      const assetId = (b as { assetId?: unknown }).assetId
      const mimeType = (b as { mimeType?: unknown }).mimeType
      if (typeof assetId === 'string') {
        out.push({ assetId, mimeType: typeof mimeType === 'string' ? mimeType : 'image/*' })
      }
    }
  }
  return out.length ? out : undefined
}

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
    .select('id, role, content, escalated, blocks')
    .eq('thread_id', id)
    .order('created_at', { ascending: true })
    .limit(200)

  const messages = (msgs ?? [])
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content ?? '',
      escalated: m.escalated ?? false,
      attachments: blocksToAttachments(m.blocks),
    }))

  return ok({ threadId: thread.id, title: thread.title, messages })
})
