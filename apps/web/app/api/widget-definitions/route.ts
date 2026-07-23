import { WIDGET_REGISTRY } from '@snowrealm/widget-engine'
import { resolveContext } from '@/lib/api/context'
import { getFlags } from '@/lib/flags'
import { ok, fail, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

/**
 * 可安裝的 widget。
 *
 * ADR-018：flag 關閉的 widget **不出現在清單中**。
 * 顯示出來再說「Coming Soon」是假關閉。
 */
export const GET = handler(async () => {
  const result = await resolveContext()
  if (!result.ok) {
    if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
    return fail('FORBIDDEN', '你沒有這個空間的存取權。')
  }
  const { ctx } = result
  const flags = await getFlags(ctx.spaceId)

  const available = Object.values(WIDGET_REGISTRY)
    .filter((def) => {
      const flag = (def as { featureFlag?: string }).featureFlag
      return !flag || flags[flag as keyof typeof flags] === true
    })
    .map((def) => ({
      id: def.id,
      name: def.name,
      category: def.category,
      description: def.description,
      defaultSize: def.defaultSize,
      minSize: def.minSize,
      maxSize: def.maxSize,
      permissions: def.permissions,
    }))

  return ok(available)
})
