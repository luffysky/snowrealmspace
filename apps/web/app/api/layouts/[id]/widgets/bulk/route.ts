import type { NextRequest } from 'next/server'
import { z } from 'zod'
import {
  GRID,
  getWidgetDefinition,
  validateItem,
  validateLayout,
  type GridItem,
} from '@snowrealm/widget-engine'
import { emitEvent } from '@snowrealm/analytics'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'
import { writePosition } from '@/lib/api/widget-position'

export const dynamic = 'force-dynamic'

const bulkSchema = z
  .object({
    breakpoint: z.enum(['desktop', 'tablet', 'mobile']),
    items: z
      .array(
        z.object({
          id: z.string().uuid(),
          x: z.number().int().min(0).optional(),
          y: z.number().int().min(0).optional(),
          w: z.number().int().min(1).optional(),
          h: z.number().int().min(1).optional(),
          order: z.number().int().min(0).optional(),
        }),
      )
      .min(1)
      .max(60),
  })
  .strict()

/**
 * 拖曳結束時批次儲存位置。
 *
 * 06-widget-contract.md §2.4：拖曳過程中不呼叫 API，
 * 只在 dragEnd / resizeEnd 呼叫一次。
 *
 * §2.3：伺服器必須驗證尺寸與重疊，**不做靜默修正** ——
 * 靜默修正會讓前後端的認知不一致。
 */
export const PATCH = handler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const result = await resolveContext()
    if (!result.ok) return fail('UNAUTHENTICATED', '請先登入。')
    const { ctx } = result
    const { id: layoutId } = await params

    const body: unknown = await request.json().catch(() => null)
    const parsed = bulkSchema.safeParse(body)
    if (!parsed.success) return failValidation(parsed.error)
    const { breakpoint, items } = parsed.data

    const { data: rows } = await ctx.db
      .from('widget_instances')
      .select('id, position, widget_definition_id, locked')
      .eq('layout_id', layoutId)
      .eq('space_id', ctx.spaceId)

    if (!rows || rows.length === 0) return fail('NOT_FOUND', '找不到這個版面的 widget。')

    const byId = new Map(rows.map((r) => [r.id, r]))

    // ── mobile：單欄排序，沒有 x/y/w/h ──
    if (breakpoint === 'mobile') {
      for (const item of items) {
        const row = byId.get(item.id)
        if (!row) return fail('NOT_FOUND', `找不到 widget ${item.id}。`)
        if (item.order === undefined) {
          return fail('VALIDATION_FAILED', '行動版需要 order 欄位。')
        }
        await ctx.db
          .from('widget_instances')
          .update({ position: writePosition(row.position, 'mobile', { order: item.order }) as never })
          .eq('id', item.id)
          .eq('space_id', ctx.spaceId)
      }
      return ok({ updated: items.length, breakpoint })
    }

    // ── desktop / tablet ──
    const columns = GRID[breakpoint].columns
    const grid: GridItem[] = []

    for (const item of items) {
      const row = byId.get(item.id)
      if (!row) return fail('NOT_FOUND', `找不到 widget ${item.id}。`)

      if (
        item.x === undefined ||
        item.y === undefined ||
        item.w === undefined ||
        item.h === undefined
      ) {
        return fail('VALIDATION_FAILED', '桌機與平板版需要 x / y / w / h。')
      }

      const definition = getWidgetDefinition(row.widget_definition_id)
      if (!definition) {
        return fail('UNPROCESSABLE', `widget ${row.widget_definition_id} 已不存在。`)
      }

      const candidate: GridItem = { id: item.id, x: item.x, y: item.y, w: item.w, h: item.h }

      const check = validateItem(
        candidate,
        {
          minW: definition.minSize.w,
          minH: definition.minSize.h,
          maxW: definition.maxSize.w,
          maxH: definition.maxSize.h,
        },
        columns,
      )
      if (!check.ok) {
        return fail('UNPROCESSABLE', `${definition.name}：${check.reason}`)
      }

      grid.push(candidate)
    }

    const layoutCheck = validateLayout(grid, columns)
    if (!layoutCheck.ok) {
      return fail('UNPROCESSABLE', layoutCheck.reason)
    }

    for (const item of grid) {
      const row = byId.get(item.id)!
      await ctx.db
        .from('widget_instances')
        .update({
          position: writePosition(row.position, breakpoint, {
            x: item.x,
            y: item.y,
            w: item.w,
            h: item.h,
          }) as never,
        })
        .eq('id', item.id)
        .eq('space_id', ctx.spaceId)
    }

    await emitEvent('layout.saved', ctx.spaceId, ctx.userId, {
      layoutId,
      breakpoint,
      widgetCount: grid.length,
    })

    return ok({ updated: grid.length, breakpoint })
  },
)
