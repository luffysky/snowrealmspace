import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/supabase/server'
import { requireUser, requireActiveSpace } from '@/lib/auth/session'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

const schema = z
  .object({
    avatarAssetId: z.string().uuid().nullable().optional(),
    displayName: z.string().trim().min(1).max(40).optional(),
  })
  .strict()
  .refine((v) => v.avatarAssetId !== undefined || v.displayName !== undefined, {
    message: '至少要改一項',
  })

/**
 * 更新使用者個人資料（profiles.display_name / avatar_asset_id）。
 *
 * 位元組只在 assets（ADR-005）—— 這裡只綁 asset id。avatarAssetId 傳 null 代表移除頭貼；
 * 傳非 null 時先驗證那個 asset 是本人 space 裡的 image（用受 RLS 約束的 client，
 * 不是成員就查不到），避免綁到別人的檔案。profiles 的更新走「own profile」RLS。
 */
export const PATCH = handler(async (request: NextRequest) => {
  const user = await requireUser()
  const { space } = await requireActiveSpace()

  const body: unknown = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)

  const db = await getDb()

  const patch: Record<string, unknown> = {}

  if (parsed.data.avatarAssetId !== undefined) {
    if (parsed.data.avatarAssetId) {
      const { data: asset } = await db
        .from('assets')
        .select('id, kind')
        .eq('id', parsed.data.avatarAssetId)
        .eq('space_id', space.id)
        .is('deleted_at', null)
        .maybeSingle()
      if (!asset) return fail('NOT_FOUND', '找不到這個檔案。')
      if (asset.kind !== 'image') return fail('VALIDATION_FAILED', '大頭貼必須是圖片。')
    }
    patch.avatar_asset_id = parsed.data.avatarAssetId
  }

  if (parsed.data.displayName !== undefined) {
    patch.display_name = parsed.data.displayName
  }

  const { error } = await db.from('profiles').update(patch as never).eq('id', user.id)
  if (error) return fail('INTERNAL', '更新失敗。')

  return ok(patch)
})
