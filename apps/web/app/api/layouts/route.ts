import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { GRID, defaultLayoutItems, getWidgetDefinition, layoutPreset } from '@snowrealm/widget-engine'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

const createSchema = z
  .object({
    name: z.string().trim().min(1).max(80).default('我的版面'),
    // 從範本建立：帶 preset key 就用該範本的 widget，否則首個版面用預設、其餘留空
    preset: z.string().max(40).optional(),
  })
  .strict()

export const GET = handler(async () => {
  const result = await resolveContext()
  if (!result.ok) {
    if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
    return fail('FORBIDDEN', '你沒有這個空間的存取權。')
  }
  const { ctx } = result

  const { data } = await ctx.db
    .from('layouts')
    .select('*, widget_instances(*)')
    .eq('space_id', ctx.spaceId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  return ok(data ?? [])
})

/**
 * 建立版面。
 *
 * 第一個版面會帶入預設 widget（06-widget-contract.md 的 defaultLayoutItems）——
 * 完全空白的 Home 會讓使用者不知道能做什麼。
 */
export const POST = handler(async (request: NextRequest) => {
  const result = await resolveContext()
  if (!result.ok) {
    if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
    return fail('FORBIDDEN', '你沒有這個空間的存取權。')
  }
  const { ctx } = result

  const body: unknown = await request.json().catch(() => ({}))
  const parsed = createSchema.safeParse(body ?? {})
  if (!parsed.success) return failValidation(parsed.error)

  const { count } = await ctx.db
    .from('layouts')
    .select('*', { count: 'exact', head: true })
    .eq('space_id', ctx.spaceId)
    .is('deleted_at', null)

  const isFirst = (count ?? 0) === 0

  const { data: layout, error } = await ctx.db
    .from('layouts')
    .insert({
      space_id: ctx.spaceId,
      name: parsed.data.name,
      is_default: isFirst,
      breakpoint_config: GRID as never,
    })
    .select('*')
    .single()

  if (error || !layout) {
    console.error('[layouts] 建立失敗', error?.message)
    return fail('INTERNAL', '無法建立版面。')
  }

  // 種子：帶 preset 用範本；否則首個版面用預設；其餘留空由使用者自己加。
  const presetItems = parsed.data.preset ? layoutPreset(parsed.data.preset)?.items : undefined
  const seedItems = presetItems ?? (isFirst ? defaultLayoutItems() : null)

  if (seedItems) {
    const seeds = seedItems.filter((item) => getWidgetDefinition(item.id) !== null)

    if (seeds.length > 0) {
      await ctx.db.from('widget_instances').insert(
        seeds.map((item) => ({
          space_id: ctx.spaceId,
          layout_id: layout.id,
          widget_definition_id: item.id,
          position: {
            desktop: { x: item.x, y: item.y, w: item.w, h: item.h },
            tablet: { x: 0, y: item.y, w: Math.min(item.w, GRID.tablet.columns), h: item.h },
            mobile: { order: item.y * 100 + item.x },
          } as never,
          config: {} as never,
        })),
      )
    }

    await ctx.db.from('spaces').update({ active_layout_id: layout.id }).eq('id', ctx.spaceId)
  }

  const { data: full } = await ctx.db
    .from('layouts')
    .select('*, widget_instances(*)')
    .eq('id', layout.id)
    .maybeSingle()

  return ok(full ?? layout, undefined, 201)
})
