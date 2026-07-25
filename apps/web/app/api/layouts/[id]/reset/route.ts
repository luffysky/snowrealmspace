import type { NextRequest } from 'next/server'
import { GRID, defaultLayoutItems, getWidgetDefinition } from '@snowrealm/widget-engine'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

/**
 * 還原成預設版面：清掉這個版面現有的 widget，重新塞入 defaultLayoutItems。
 * 與 api/layouts POST 的首個版面 seed 用同一份預設與同一種 position 形狀。
 */
export const POST = handler(async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const result = await resolveContext()
  if (!result.ok) return fail(result.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '沒有存取權。')
  const { ctx } = result
  const { id: layoutId } = await params

  // 版面必須屬於這個 space（RLS：查不到就不是成員的）
  const { data: layout } = await ctx.db
    .from('layouts')
    .select('id')
    .eq('id', layoutId)
    .eq('space_id', ctx.spaceId)
    .maybeSingle()
  if (!layout) return fail('NOT_FOUND', '找不到這個版面。')

  // 清掉現有 widget
  const { error: delErr } = await ctx.db
    .from('widget_instances')
    .delete()
    .eq('layout_id', layoutId)
    .eq('space_id', ctx.spaceId)
  if (delErr) return fail('INTERNAL', '還原失敗（清除舊 widget）。')

  // 重塞預設
  const seeds = defaultLayoutItems().filter((item) => getWidgetDefinition(item.id) !== null)
  if (seeds.length > 0) {
    const { error: insErr } = await ctx.db.from('widget_instances').insert(
      seeds.map((item) => ({
        space_id: ctx.spaceId,
        layout_id: layoutId,
        widget_definition_id: item.id,
        position: {
          desktop: { x: item.x, y: item.y, w: item.w, h: item.h },
          tablet: { x: 0, y: item.y, w: Math.min(item.w, GRID.tablet.columns), h: item.h },
          mobile: { order: item.y * 100 + item.x },
        } as never,
        config: {} as never,
      })),
    )
    if (insErr) return fail('INTERNAL', '還原失敗（重建預設）。')
  }

  return ok({ reset: true, count: seeds.length })
})
