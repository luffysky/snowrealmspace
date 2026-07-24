import type { NextRequest } from 'next/server'
import { folderPatchSchema } from '@snowrealm/validation'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

/** 改資料夾名稱。 */
export const PATCH = handler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const result = await resolveContext()
    if (!result.ok) return fail('UNAUTHENTICATED', '請先登入。')
    const { ctx } = result
    const { id } = await params

    const body: unknown = await request.json().catch(() => null)
    const parsed = folderPatchSchema.safeParse(body)
    if (!parsed.success) return failValidation(parsed.error)

    const { data, error } = await ctx.db
      .from('folders')
      .update({ name: parsed.data.name, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('space_id', ctx.spaceId)
      .is('deleted_at', null)
      .select('id, name, created_at')
      .maybeSingle()

    if (error) return fail('INTERNAL', '無法更新資料夾。')
    if (!data) return fail('NOT_FOUND', '找不到這個資料夾。')
    return ok(data)
  },
)

/**
 * 刪除資料夾（軟刪除）。**不刪檔案**——先把裡面的檔案移出（folder_id → null），
 * 再軟刪資料夾。走 RLS：只有成員能改自己 space 的資料。
 */
export const DELETE = handler(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const result = await resolveContext()
    if (!result.ok) return fail('UNAUTHENTICATED', '請先登入。')
    const { ctx } = result
    const { id } = await params

    // 先把檔案移出這個資料夾（不刪檔）
    await ctx.db
      .from('assets')
      .update({ folder_id: null })
      .eq('folder_id', id)
      .eq('space_id', ctx.spaceId)

    const { error } = await ctx.db
      .from('folders')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('space_id', ctx.spaceId)

    if (error) return fail('INTERNAL', '無法刪除資料夾。')
    return ok({ id, deleted: true })
  },
)
