import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

const patchSchema = z
  .object({
    displayName: z.string().trim().min(1, '請輸入名字').max(40, '名字太長（最多 40 字）').optional(),
    // null = 移除頭貼
    avatarAssetId: z.string().uuid().nullable().optional(),
  })
  .strict()
  .refine((d) => d.displayName !== undefined || d.avatarAssetId !== undefined, {
    message: '沒有要更新的欄位。',
  })

/**
 * AI 夥伴的檔案（agent_profiles）：命名與大頭貼。
 * 走 RLS：只有 space owner 能寫（0003「owner writes agent profile」）。
 * 位元組只在 assets（ADR-005）—— 頭貼只綁 asset id，且先驗證是本 space 的 image。
 */
export const PATCH = handler(async (request: NextRequest) => {
  const result = await resolveContext()
  if (!result.ok) {
    return result.reason === 'unauthenticated'
      ? fail('UNAUTHENTICATED', '請先登入。')
      : fail('FORBIDDEN', '你沒有這個空間的存取權。')
  }
  const { ctx } = result

  const body: unknown = await request.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)

  const patch: { display_name?: string; avatar_asset_id?: string | null } = {}
  if (parsed.data.displayName !== undefined) patch.display_name = parsed.data.displayName

  if (parsed.data.avatarAssetId !== undefined) {
    if (parsed.data.avatarAssetId) {
      const { data: asset } = await ctx.db
        .from('assets')
        .select('id, kind')
        .eq('id', parsed.data.avatarAssetId)
        .eq('space_id', ctx.spaceId)
        .is('deleted_at', null)
        .maybeSingle()
      if (!asset) return fail('NOT_FOUND', '找不到這個檔案。')
      if (asset.kind !== 'image') return fail('VALIDATION_FAILED', '大頭貼必須是圖片。')
    }
    patch.avatar_asset_id = parsed.data.avatarAssetId
  }

  const { error, data } = await ctx.db
    .from('agent_profiles')
    .update(patch as never)
    .eq('space_id', ctx.spaceId)
    .select('display_name, avatar_asset_id')
    .maybeSingle()

  // RLS 擋下非 owner 的寫入 → 回 forbidden 而非假成功
  if (error) return fail('INTERNAL', '儲存失敗。')
  if (!data) return fail('FORBIDDEN', '只有空間擁有者能編輯 AI 夥伴。')

  return ok({ displayName: data.display_name, avatarAssetId: (data as { avatar_asset_id: string | null }).avatar_asset_id })
})
