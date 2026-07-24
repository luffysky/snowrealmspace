import type { NextRequest } from 'next/server'
import { principleReorderSchema } from '@snowrealm/validation'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

/** 依前端傳來的順序重排 position。只更新屬於本 space 的（RLS 再保一層）。 */
export const POST = handler(async (request: NextRequest) => {
  const result = await resolveContext()
  if (!result.ok) {
    if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
    return fail('FORBIDDEN', '你沒有這個空間的存取權。')
  }
  const { ctx } = result

  const body: unknown = await request.json().catch(() => null)
  const parsed = principleReorderSchema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)

  const { orderedIds } = parsed.data
  for (let i = 0; i < orderedIds.length; i++) {
    await ctx.db
      .from('design_principles')
      .update({ position: i })
      .eq('id', orderedIds[i]!)
      .eq('space_id', ctx.spaceId)
  }
  return ok({ reordered: orderedIds.length })
})
