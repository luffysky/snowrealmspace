import type { NextRequest } from 'next/server'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

/** 撤銷分享連結（設 revoked_at；保留列以留紀錄）。 */
export const DELETE = handler(async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const result = await resolveContext()
  if (!result.ok) return fail(result.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '沒有存取權。')
  const { ctx } = result
  const { id } = await params
  const { error } = await ctx.db
    .from('share_links')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('space_id', ctx.spaceId)
  if (error) return fail('INTERNAL', '撤銷失敗。')
  return ok({ id, revoked: true })
})
