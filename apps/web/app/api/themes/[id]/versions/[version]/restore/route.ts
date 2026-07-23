import type { NextRequest } from 'next/server'
import { analyzeTheme, themeDefinitionSchema } from '@snowrealm/theme-engine'
import { emitEvent } from '@snowrealm/analytics'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

/** 還原到某個版本。還原本身也會先把目前狀態存成新版本，避免不可逆。 */
export const POST = handler(
  async (
    _req: NextRequest,
    { params }: { params: Promise<{ id: string; version: string }> },
  ) => {
    const result = await resolveContext()
    if (!result.ok) return fail('UNAUTHENTICATED', '請先登入。')
    const { ctx } = result
    const { id, version } = await params

    const versionNumber = Number(version)
    if (!Number.isInteger(versionNumber)) {
      return fail('VALIDATION_FAILED', '版本編號不正確。')
    }

    const { data: target } = await ctx.db
      .from('theme_versions')
      .select('definition, version')
      .eq('theme_id', id)
      .eq('space_id', ctx.spaceId)
      .eq('version', versionNumber)
      .maybeSingle()

    if (!target) return fail('NOT_FOUND', '找不到這個版本。')

    const parsed = themeDefinitionSchema.safeParse(target.definition)
    if (!parsed.success) {
      // 舊版本的格式已不合法（schema 演進過）——誠實告知而不是強行套用
      return fail('UNPROCESSABLE', '這個版本的格式已不受支援，無法還原。')
    }

    const { data: current } = await ctx.db
      .from('themes')
      .select('definition')
      .eq('id', id)
      .eq('space_id', ctx.spaceId)
      .maybeSingle()

    // 還原前先把目前狀態存成版本，讓「還原」本身可以被還原
    if (current) {
      const { data: latest } = await ctx.db
        .from('theme_versions')
        .select('version')
        .eq('theme_id', id)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle()

      await ctx.db.from('theme_versions').insert({
        theme_id: id,
        space_id: ctx.spaceId,
        version: (latest?.version ?? 0) + 1,
        label: `還原前（自動）`,
        definition: current.definition,
        created_by: ctx.userId,
      })
    }

    const { data, error } = await ctx.db
      .from('themes')
      .update({
        definition: parsed.data as never,
        a11y_report: analyzeTheme(parsed.data) as never,
      })
      .eq('id', id)
      .eq('space_id', ctx.spaceId)
      .select('id, name, definition, a11y_report')
      .maybeSingle()

    if (error || !data) return fail('INTERNAL', '無法還原。')

    await emitEvent('theme.updated', ctx.spaceId, ctx.userId, { themeId: id })
    return ok({ ...data, restoredFrom: versionNumber })
  },
)
