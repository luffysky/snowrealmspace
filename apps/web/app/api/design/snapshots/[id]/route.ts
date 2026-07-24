import type { NextRequest } from 'next/server'
import { createAdminClient } from '@snowrealm/db/server'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

/**
 * 刪除一個版本快照。
 *
 * snapshot 由 service role 管理（成員無 DELETE policy）。
 * 擋掉「刪掉作品最後一個版本」—— 沒有版本的作品沒有意義，
 * 要清掉整個作品應該刪 design_file 而非把版本一個個刪光。
 */
export const DELETE = handler(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const result = await resolveContext()
    if (!result.ok) {
      if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
      return fail('FORBIDDEN', '你沒有這個空間的存取權。')
    }
    const { ctx } = result
    const { id } = await params

    // 受 RLS 約束：讀得到才是本 space 的
    const { data: snap } = await ctx.db
      .from('design_snapshots')
      .select('id, design_file_id')
      .eq('id', id)
      .eq('space_id', ctx.spaceId)
      .maybeSingle()
    if (!snap) return fail('NOT_FOUND', '找不到這個版本。')

    const { count } = await ctx.db
      .from('design_snapshots')
      .select('id', { count: 'exact', head: true })
      .eq('design_file_id', snap.design_file_id)
      .eq('space_id', ctx.spaceId)

    if ((count ?? 0) <= 1) {
      return fail('CONFLICT', '這是作品僅存的版本。要移除的話請刪除整個作品。')
    }

    const { error } = await createAdminClient().from('design_snapshots').delete().eq('id', id)
    if (error) {
      console.error('[design.snapshots] 刪除失敗', error.message)
      return fail('INTERNAL', '無法刪除版本。')
    }
    return ok({ id, deleted: true })
  },
)
