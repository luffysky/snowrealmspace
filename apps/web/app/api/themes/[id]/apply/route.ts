import type { NextRequest } from 'next/server'
import { emitEvent, audit } from '@snowrealm/analytics'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

/** 套用主題。v1.0 §55：「所有設定會保存」。 */
export const POST = handler(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const result = await resolveContext()
    if (!result.ok) return fail('UNAUTHENTICATED', '請先登入。')
    const { ctx } = result
    const { id } = await params

    const { data: theme } = await ctx.db
      .from('themes')
      .select('id, name')
      .eq('id', id)
      .eq('space_id', ctx.spaceId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!theme) return fail('NOT_FOUND', '找不到這個主題。')

    const { data: space } = await ctx.db
      .from('spaces')
      .select('active_theme_id')
      .eq('id', ctx.spaceId)
      .maybeSingle()

    const previousThemeId = space?.active_theme_id ?? null

    const { error } = await ctx.db
      .from('spaces')
      .update({ active_theme_id: id })
      .eq('id', ctx.spaceId)

    // RLS 只讓 owner 寫 spaces
    if (error) return fail('INSUFFICIENT_ROLE', '只有空間擁有者可以套用主題。')

    await audit({
      spaceId: ctx.spaceId,
      actorId: ctx.userId,
      action: 'theme.applied',
      entityType: 'theme',
      entityId: id,
      before: { activeThemeId: previousThemeId },
      after: { activeThemeId: id },
    })

    await emitEvent('theme.applied', ctx.spaceId, ctx.userId, {
      themeId: id,
      previousThemeId,
      source: 'user',
    })

    return ok({ themeId: id, previousThemeId })
  },
)
