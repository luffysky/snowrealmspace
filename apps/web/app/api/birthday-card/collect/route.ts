import type { NextRequest } from 'next/server'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

/**
 * 壽星在 Home 親手打開信封後「收進驚喜收藏」。
 * 設 space_settings.birthday_card_collected_at = now()（只設一次，已收藏就沿用原時間）。
 * 之後這張卡改於驚喜收藏頁常駐、不再佔據 Home。RLS：只有本 space owner 能改自己的設定。
 */
export const POST = handler(async (_req: NextRequest) => {
  const result = await resolveContext()
  if (!result.ok) {
    if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
    return fail('FORBIDDEN', '你沒有這個空間的存取權。')
  }
  const { ctx } = result

  const { data: existing } = await ctx.db
    .from('space_settings')
    .select('birthday_card_collected_at')
    .eq('space_id', ctx.spaceId)
    .maybeSingle()

  const collectedAt = existing?.birthday_card_collected_at ?? new Date().toISOString()

  if (!existing?.birthday_card_collected_at) {
    const { error } = await ctx.db
      .from('space_settings')
      .update({ birthday_card_collected_at: collectedAt })
      .eq('space_id', ctx.spaceId)
    if (error) {
      console.error('[birthday-card.collect] 更新失敗', error.message)
      return fail('INTERNAL', '收藏失敗，再試一次。')
    }
  }

  return ok({ collectedAt })
})
