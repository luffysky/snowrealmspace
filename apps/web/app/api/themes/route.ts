import type { NextRequest } from 'next/server'
import { themeCreateSchema } from '@snowrealm/validation'
import { analyzeTheme } from '@snowrealm/theme-engine'
import { emitEvent } from '@snowrealm/analytics'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

export const GET = handler(async (request: NextRequest) => {
  const result = await resolveContext()
  if (!result.ok) {
    if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
    return fail('FORBIDDEN', '你沒有這個空間的存取權。')
  }
  const { ctx } = result
  const favoritesOnly = request.nextUrl.searchParams.get('favorites') === 'true'

  let query = ctx.db
    .from('themes')
    .select('id, name, definition, source, is_favorite, a11y_report, updated_at')
    .eq('space_id', ctx.spaceId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(60)

  if (favoritesOnly) query = query.eq('is_favorite', true)

  const { data, error } = await query
  if (error) {
    console.error('[themes] 查詢失敗', error.message)
    return fail('INTERNAL', '無法載入主題。')
  }

  return ok(data ?? [])
})

export const POST = handler(async (request: NextRequest) => {
  const result = await resolveContext()
  if (!result.ok) {
    if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
    return fail('FORBIDDEN', '你沒有這個空間的存取權。')
  }
  const { ctx } = result

  const body: unknown = await request.json().catch(() => null)
  const parsed = themeCreateSchema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)

  const input = parsed.data
  // 對比報告在儲存時算好並快取，避免每次渲染重算（05-theme-tokens.md §3.2）
  const report = analyzeTheme(input.definition)

  const { data, error } = await ctx.db
    .from('themes')
    .insert({
      space_id: ctx.spaceId,
      created_by: ctx.userId,
      name: input.name,
      definition: input.definition as never,
      source: input.source,
      source_asset_id: input.sourceAssetId ?? null,
      a11y_report: report as never,
    })
    .select('id, name, definition, a11y_report')
    .single()

  if (error || !data) {
    console.error('[themes] 建立失敗', error?.message)
    return fail('INTERNAL', '無法建立主題。')
  }

  await emitEvent('theme.created', ctx.spaceId, ctx.userId, {
    themeId: data.id,
    name: data.name,
    source: input.source,
  })

  return ok(data, undefined, 201)
})
