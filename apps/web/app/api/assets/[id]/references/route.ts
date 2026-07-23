import type { NextRequest } from 'next/server'
import { createAdminClient } from '@snowrealm/db/server'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, handler } from '@/lib/api/respond'
import { findReferences } from '@/lib/api/asset-references'

export const dynamic = 'force-dynamic'

/** 刪除前讓使用者先看「刪了會影響什麼」。 */
export const GET = handler(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const result = await resolveContext()
    if (!result.ok) return fail('UNAUTHENTICATED', '請先登入。')
    const { ctx } = result
    const { id } = await params

    const { data: asset } = await ctx.db
      .from('assets')
      .select('id')
      .eq('id', id)
      .eq('space_id', ctx.spaceId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!asset) return fail('NOT_FOUND', '找不到這個檔案。')

    const references = await findReferences(createAdminClient(), ctx.spaceId, id)
    return ok({ references })
  },
)
