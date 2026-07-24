import type { NextRequest } from 'next/server'
import { snapshotCompareSchema } from '@snowrealm/validation'
import { compareLocalFeatures, type LocalFeatures } from '@snowrealm/theme-engine'
import { emitEvent } from '@snowrealm/analytics'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

/**
 * 比較兩個版本，回傳本地計算的數值差異（色彩距離、尺寸、統計）。
 * 無 AI、無文字摘要（那是 Milestone D）—— 只有可重現的數值。
 */
export const POST = handler(async (request: NextRequest) => {
  const result = await resolveContext()
  if (!result.ok) {
    if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
    return fail('FORBIDDEN', '你沒有這個空間的存取權。')
  }
  const { ctx } = result

  const body: unknown = await request.json().catch(() => null)
  const parsed = snapshotCompareSchema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)
  const { a, b } = parsed.data

  // 受 RLS 約束：只讀得到本 space 的 snapshot
  const { data: snaps, error } = await ctx.db
    .from('design_snapshots')
    .select('id, asset_id, extracted_features')
    .in('id', [a, b])
    .eq('space_id', ctx.spaceId)

  if (error) return fail('INTERNAL', '無法載入版本。')
  const rowA = snaps?.find((s) => s.id === a)
  const rowB = snaps?.find((s) => s.id === b)
  if (!rowA || !rowB) return fail('NOT_FOUND', '找不到要比較的版本。')

  const comparison = compareLocalFeatures(
    (rowA.extracted_features ?? {}) as LocalFeatures,
    (rowB.extracted_features ?? {}) as LocalFeatures,
  )

  await emitEvent('design.compared', ctx.spaceId, ctx.userId, {
    snapshotIdA: a,
    snapshotIdB: b,
  })

  return ok({
    a: { id: rowA.id, assetId: rowA.asset_id },
    b: { id: rowB.id, assetId: rowB.asset_id },
    comparison,
  })
})
