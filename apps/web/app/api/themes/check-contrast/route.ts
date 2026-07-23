import type { NextRequest } from 'next/server'
import { contrastCheckSchema } from '@snowrealm/validation'
import { contrastRatio, wcagLevel, THRESHOLDS } from '@snowrealm/theme-engine'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

/**
 * 即時對比檢查。純計算、無副作用。
 *
 * Theme Studio 邊拖色票邊呼叫。實際上前端也能自己算（同一個套件），
 * 這個端點是給外部工具與測試用的。
 */
export const POST = handler(async (request: NextRequest) => {
  const result = await resolveContext()
  if (!result.ok) return fail('UNAUTHENTICATED', '請先登入。')

  const body: unknown = await request.json().catch(() => null)
  const parsed = contrastCheckSchema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)

  const results = parsed.data.pairs.map((p) => {
    const ratio = contrastRatio(p.fg, p.bg)
    return {
      label: p.label ?? null,
      fg: p.fg,
      bg: p.bg,
      size: p.size,
      ratio: Math.round(ratio * 100) / 100,
      required: THRESHOLDS[p.size].aa,
      level: wcagLevel(ratio, p.size),
      passesAA: wcagLevel(ratio, p.size) !== 'fail',
    }
  })

  return ok({ results })
})
