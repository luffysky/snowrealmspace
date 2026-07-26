import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

const patchSchema = z
  .object({ displayName: z.string().trim().min(1, '請輸入名字').max(40, '名字太長（最多 40 字）') })
  .strict()

/**
 * 幫這個空間的 AI 夥伴命名（agent_profiles.display_name）。
 * 走 RLS：只有 space owner 能寫（0003 「owner writes agent profile」）。
 */
export const PATCH = handler(async (request: NextRequest) => {
  const result = await resolveContext()
  if (!result.ok) {
    return result.reason === 'unauthenticated'
      ? fail('UNAUTHENTICATED', '請先登入。')
      : fail('FORBIDDEN', '你沒有這個空間的存取權。')
  }
  const { ctx } = result

  const body: unknown = await request.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)

  const { error, data } = await ctx.db
    .from('agent_profiles')
    .update({ display_name: parsed.data.displayName })
    .eq('space_id', ctx.spaceId)
    .select('display_name')
    .maybeSingle()

  // RLS 擋下非 owner 的寫入 → 回 forbidden 而非假成功
  if (error) return fail('INTERNAL', '儲存失敗。')
  if (!data) return fail('FORBIDDEN', '只有空間擁有者能幫 AI 命名。')

  return ok({ displayName: data.display_name })
})
