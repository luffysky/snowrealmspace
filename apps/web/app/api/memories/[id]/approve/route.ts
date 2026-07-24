import type { NextRequest } from 'next/server'
import { emitEvent } from '@snowrealm/analytics'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

/**
 * 批准一則 Agent 提案的記憶（ADR-014 的第二層：approved 只能透過使用者的這個動作變 true）。
 * RLS owner policy + resolveContext 確保只有 owner 能批准。
 */
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
      .update({ approved: true, rejected_at: null })
      .eq('id', id)
      .eq('space_id', ctx.spaceId)
      .eq('approved', false)
      .is('deleted_at', null)
      .select('id, type, source_type')
      .maybeSingle()

    if (error) return fail('INTERNAL', '無法批准。')
    if (!data) return fail('NOT_FOUND', '找不到這則待批准的記憶。')

    await emitEvent('memory.approved', ctx.spaceId, ctx.userId, {
      memoryId: data.id,
      type: data.type,
      sourceType: data.source_type,
    }).catch(() => {})
    return ok({ id: data.id, approved: true })
  },
)
