import type { NextRequest } from 'next/server'
import { themePatchSchema } from '@snowrealm/validation'
import { analyzeTheme } from '@snowrealm/theme-engine'
import { emitEvent, audit } from '@snowrealm/analytics'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

export const GET = handler(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const result = await resolveContext()
    if (!result.ok) return fail('UNAUTHENTICATED', '請先登入。')
    const { ctx } = result
    const { id } = await params

    const { data } = await ctx.db
      .from('themes')
      .select('*')
      .eq('id', id)
      .eq('space_id', ctx.spaceId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!data) return fail('NOT_FOUND', '找不到這個主題。')
    return ok(data)
  },
)

export const PATCH = handler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const result = await resolveContext()
    if (!result.ok) return fail('UNAUTHENTICATED', '請先登入。')
    const { ctx } = result
    const { id } = await params

    const body: unknown = await request.json().catch(() => null)
    const parsed = themePatchSchema.safeParse(body)
    if (!parsed.success) return failValidation(parsed.error)
    const input = parsed.data

    const { data: current } = await ctx.db
      .from('themes')
      .select('id, definition, is_preset')
      .eq('id', id)
      .eq('space_id', ctx.spaceId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!current) return fail('NOT_FOUND', '找不到這個主題。')
    if (current.is_preset && input.definition) {
      return fail('UNPROCESSABLE', '內建主題不可修改，請先另存新檔。')
    }

    const patch: { name?: string; is_favorite?: boolean; definition?: never; a11y_report?: never } = {}
    if (input.name !== undefined) patch.name = input.name
    if (input.isFavorite !== undefined) patch.is_favorite = input.isFavorite
    if (input.definition !== undefined) {
      patch.definition = input.definition as never
      patch.a11y_report = analyzeTheme(input.definition) as never
    }

    const { data, error } = await ctx.db
      .from('themes')
      .update(patch)
      .eq('id', id)
      .eq('space_id', ctx.spaceId)
      .select('id, name, definition, a11y_report, is_favorite')
      .maybeSingle()

    if (error) {
      console.error('[themes] 更新失敗', error.message)
      return fail('INTERNAL', '無法更新主題。')
    }
    if (!data) return fail('NOT_FOUND', '找不到這個主題。')

    await emitEvent('theme.updated', ctx.spaceId, ctx.userId, { themeId: id })
    return ok(data)
  },
)

export const DELETE = handler(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const result = await resolveContext()
    if (!result.ok) return fail('UNAUTHENTICATED', '請先登入。')
    const { ctx } = result
    const { id } = await params

    const { data: theme } = await ctx.db
      .from('themes')
      .select('id, name, is_preset')
      .eq('id', id)
      .eq('space_id', ctx.spaceId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!theme) return fail('NOT_FOUND', '找不到這個主題。')
    if (theme.is_preset) return fail('UNPROCESSABLE', '內建主題不可刪除。')

    // 正在套用的主題不能刪 —— 刪了 space 會沒有外觀
    const { data: space } = await ctx.db
      .from('spaces')
      .select('active_theme_id')
      .eq('id', ctx.spaceId)
      .maybeSingle()

    if (space?.active_theme_id === id) {
      return fail('CONFLICT', '這是目前套用中的主題，請先套用其他主題再刪除。')
    }

    const { error } = await ctx.db
      .from('themes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('space_id', ctx.spaceId)

    if (error) return fail('INTERNAL', '無法刪除主題。')

    await audit({
      spaceId: ctx.spaceId,
      actorId: ctx.userId,
      action: 'theme.deleted',
      entityType: 'theme',
      entityId: id,
      before: { name: theme.name },
    })
    await emitEvent('theme.deleted', ctx.spaceId, ctx.userId, { themeId: id })

    return ok({ id, deleted: true })
  },
)
