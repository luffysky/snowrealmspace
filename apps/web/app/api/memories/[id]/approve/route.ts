import type { NextRequest } from 'next/server'
import { emitEvent } from '@snowrealm/analytics'
import { toVectorLiteral } from '@snowrealm/ai-core'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, handler } from '@/lib/api/respond'
import { buildCompleteDeps } from '@/lib/ai/deps'
import { embedForUsage } from '@/lib/ai/embed'

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
      .select('id, type, source_type, content')
      .maybeSingle()

    if (error) return fail('INTERNAL', '無法批准。')
    if (!data) return fail('NOT_FOUND', '找不到這則待批准的記憶。')

    // 批准後生成語意向量（供未來語意檢索）。失敗不擋批准 —— 記憶仍存在，
    // 只是暫時沒有向量，之後 backfill 或下次觸發可補上（誠實降級，不假裝失敗）。
    if (data.content) {
      try {
        const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date())
        const deps = await buildCompleteDeps(ctx.spaceId, localDate, ctx.userId)
        const vector = await embedForUsage(data.content, deps)
        if (vector) {
          await ctx.db
            .from('memories')
            .update({ embedding: toVectorLiteral(vector) })
            .eq('id', data.id)
            .eq('space_id', ctx.spaceId)
        }
      } catch (err) {
        console.error('[memory.approve] embedding 生成失敗（不擋批准）：', (err as Error).message)
      }
    }

    await emitEvent('memory.approved', ctx.spaceId, ctx.userId, {
      memoryId: data.id,
      type: data.type,
      sourceType: data.source_type,
    }).catch(() => {})
    return ok({ id: data.id, approved: true })
  },
)
