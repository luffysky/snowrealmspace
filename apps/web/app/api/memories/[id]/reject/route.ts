import type { NextRequest } from 'next/server'
import { emitEvent } from '@snowrealm/analytics'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

/** 拒絕一則 Agent 提案的記憶（標記 rejected_at，不再出現在待批准清單）。 */
export const POST = handler(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const result = await resolveContext()
    if (!result.ok) {
      if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
      return fail('FORBIDDEN', '你沒有這個空間的存取權。')
    }
    const { ctx } = result
    const { id } = await params

    const { data, error } = await ctx.db
      .from('memories')
      .update({ rejected_at: new Date().toISOString() })
      .eq('id', id)
      .eq('space_id', ctx.spaceId)
      .eq('approved', false)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle()

    if (error) return fail('INTERNAL', '無法拒絕。')
    if (!data) return fail('NOT_FOUND', '找不到這則待批准的記憶。')

    await emitEvent('memory.rejected', ctx.spaceId, ctx.userId, { memoryId: data.id }).catch(() => {})
    return ok({ id: data.id, rejected: true })
  },
)
