import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/supabase/server'
import { requireActiveSpace } from '@/lib/auth/session'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

const schema = z
  .object({
    name: z.string().trim().min(1, '名稱不可空白').max(80, '名稱最多 80 字').optional(),
    // 深/淺色模式各自指定的背景（null = 取消指定，退回播放清單）
    bgLightItemId: z.string().uuid().nullable().optional(),
    bgDarkItemId: z.string().uuid().nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: '沒有要更新的欄位' })

/**
 * 更新目前空間：改名、或指定深/淺色模式的背景。
 *
 * 空間 id 一律取自 session（requireActiveSpace），不吃 client 傳來的 id。
 * 授權雙保險：擋非 owner + DB 的 `owner writes space` RLS（用 getDb）。
 * 指定背景時先驗證那個 background_item 屬於本 space（RLS 也會擋）。
 */
export const PATCH = handler(async (request: NextRequest) => {
  const { space, role } = await requireActiveSpace()
  if (role !== 'owner') return fail('FORBIDDEN', '只有空間擁有者可以更新空間。')

  const body: unknown = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)
  const { name, bgLightItemId, bgDarkItemId } = parsed.data

  const db = await getDb()

  // 驗證指定的背景屬於本 space（非 null 時）
  for (const id of [bgLightItemId, bgDarkItemId]) {
    if (id) {
      const { data: bg } = await db
        .from('background_items')
        .select('id')
        .eq('id', id)
        .eq('space_id', space.id)
        .is('deleted_at', null)
        .maybeSingle()
      if (!bg) return fail('NOT_FOUND', '找不到這個背景。')
    }
  }

  const patch: Record<string, unknown> = {}
  if (name !== undefined) patch.name = name
  if (bgLightItemId !== undefined) patch.bg_light_item_id = bgLightItemId
  if (bgDarkItemId !== undefined) patch.bg_dark_item_id = bgDarkItemId

  const { data, error } = await db
    .from('spaces')
    .update(patch as never)
    .eq('id', space.id)
    .select('name, bg_light_item_id, bg_dark_item_id')
    .maybeSingle()
  if (error) return fail('INTERNAL', '更新失敗。')
  if (!data) return fail('FORBIDDEN', '沒有權限更新這個空間。')

  return ok({
    name: data.name,
    bgLightItemId: data.bg_light_item_id,
    bgDarkItemId: data.bg_dark_item_id,
  })
})
