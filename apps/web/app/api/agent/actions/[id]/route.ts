import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'
import { confirmAction, rejectAction, undoAction } from '@/lib/agent/tools'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({ op: z.enum(['confirm', 'reject', 'undo']) }).strict()

/**
 * 對一個 agent_action 執行 confirm / reject / undo（07-agent.md §5、§4.1）。
 * 全部走 owner 的顯式動作 —— Agent 不能自己確認自己的動作。
 */
export const POST = handler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const result = await resolveContext()
    if (!result.ok) {
      if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
      return fail('FORBIDDEN', '你沒有這個空間的存取權。')
    }
    const { ctx } = result
    const { id } = await params

    const body: unknown = await request.json().catch(() => null)
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) return failValidation(parsed.error)

    if (parsed.data.op === 'reject') {
      const okRejected = await rejectAction(ctx, id)
      if (!okRejected) return fail('NOT_FOUND', '找不到待確認的動作。')
      return ok({ id, rejected: true })
    }

    const outcome =
      parsed.data.op === 'confirm' ? await confirmAction(ctx, id) : await undoAction(ctx, id)

    if (outcome.status === 'rejected') return fail('UNPROCESSABLE', outcome.reason)
    return ok(outcome)
  },
)
