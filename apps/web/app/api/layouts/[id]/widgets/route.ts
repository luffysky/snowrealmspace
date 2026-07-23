import type { NextRequest } from 'next/server'
import { z } from 'zod'
import {
  GRID,
  getWidgetDefinition,
  compactLayout,
  validateItem,
  type GridItem,
} from '@snowrealm/widget-engine'
import { emitEvent } from '@snowrealm/analytics'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'
import { readPositions } from '@/lib/api/widget-position'

export const dynamic = 'force-dynamic'

const addSchema = z.object({ widgetDefinitionId: z.string().min(1).max(64) }).strict()

/** 新增 widget。自動放到不會重疊的位置。 */
export const POST = handler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const result = await resolveContext()
    if (!result.ok) return fail('UNAUTHENTICATED', '請先登入。')
    const { ctx } = result
    const { id: layoutId } = await params

    const body: unknown = await request.json().catch(() => null)
    const parsed = addSchema.safeParse(body)
    if (!parsed.success) return failValidation(parsed.error)

    const definition = getWidgetDefinition(parsed.data.widgetDefinitionId)
    if (!definition) return fail('NOT_FOUND', '找不到這個 widget。')

    const { data: layout } = await ctx.db
      .from('layouts')
      .select('id')
      .eq('id', layoutId)
      .eq('space_id', ctx.spaceId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!layout) return fail('NOT_FOUND', '找不到這個版面。')

    const { data: existing } = await ctx.db
      .from('widget_instances')
      .select('id, position')
      .eq('layout_id', layoutId)

    const current = readPositions(existing ?? [], 'desktop')
    // 放到最底下，再讓重力壓縮把它拉到最近的空位
    const bottom = current.reduce((max, i) => Math.max(max, i.y + i.h), 0)
    const placed: GridItem = {
      id: 'new',
      x: 0,
      y: bottom,
      w: definition.defaultSize.w,
      h: definition.defaultSize.h,
    }

    const check = validateItem(
      placed,
      {
        minW: definition.minSize.w,
        minH: definition.minSize.h,
        maxW: definition.maxSize.w,
        maxH: definition.maxSize.h,
      },
      GRID.desktop.columns,
    )
    if (!check.ok) return fail('UNPROCESSABLE', check.reason)

    const compacted = compactLayout([...current, placed])
    const final = compacted.find((i) => i.id === 'new')!

    const { data, error } = await ctx.db
      .from('widget_instances')
      .insert({
        space_id: ctx.spaceId,
        layout_id: layoutId,
        widget_definition_id: definition.id,
        position: {
          desktop: { x: final.x, y: final.y, w: final.w, h: final.h },
          tablet: {
            x: 0,
            y: final.y,
            w: Math.min(final.w, GRID.tablet.columns),
            h: final.h,
          },
          mobile: { order: current.length },
        } as never,
        config: definition.defaultConfig as never,
      })
      .select('*')
      .single()

    if (error || !data) {
      console.error('[widgets] 新增失敗', error?.message)
      return fail('INTERNAL', '無法新增 widget。')
    }

    await emitEvent('widget.added', ctx.spaceId, ctx.userId, {
      definitionId: definition.id,
      layoutId,
    })

    return ok(data, undefined, 201)
  },
)
