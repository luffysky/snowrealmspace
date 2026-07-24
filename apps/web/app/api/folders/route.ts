import type { NextRequest } from 'next/server'
import { folderCreateSchema } from '@snowrealm/validation'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

/** 這個空間的資料夾清單，附每個資料夾的（未刪除）檔案數。 */
export const GET = handler(async () => {
  const result = await resolveContext()
  if (!result.ok) {
    if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
    return fail('FORBIDDEN', '你沒有這個空間的存取權。')
  }
  const { ctx } = result

  const { data: folders, error } = await ctx.db
    .from('folders')
    .select('id, name, created_at')
    .eq('space_id', ctx.spaceId)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) {
    console.error('[folders] 查詢失敗', error.message)
    return fail('INTERNAL', '無法載入資料夾。')
  }

  // 每個資料夾的檔案數（未刪除、未封存不另計，單純看歸屬）
  const { data: counts } = await ctx.db
    .from('assets')
    .select('folder_id')
    .eq('space_id', ctx.spaceId)
    .is('deleted_at', null)
    .not('folder_id', 'is', null)

  const countByFolder = new Map<string, number>()
  for (const row of counts ?? []) {
    if (row.folder_id) countByFolder.set(row.folder_id, (countByFolder.get(row.folder_id) ?? 0) + 1)
  }

  return ok(
    (folders ?? []).map((f) => ({ ...f, count: countByFolder.get(f.id) ?? 0 })),
  )
})

/** 建立資料夾。 */
export const POST = handler(async (request: NextRequest) => {
  const result = await resolveContext()
  if (!result.ok) {
    if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
    return fail('FORBIDDEN', '你沒有這個空間的存取權。')
  }
  const { ctx } = result

  const body: unknown = await request.json().catch(() => null)
  const parsed = folderCreateSchema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)

  const { data, error } = await ctx.db
    .from('folders')
    .insert({ space_id: ctx.spaceId, created_by: ctx.userId, name: parsed.data.name })
    .select('id, name, created_at')
    .single()

  if (error || !data) {
    console.error('[folders] 建立失敗', error?.message)
    return fail('INTERNAL', '無法建立資料夾。')
  }
  return ok({ ...data, count: 0 }, undefined, 201)
})
