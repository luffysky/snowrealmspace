import type { NextRequest } from 'next/server'
import { snapshotCreateSchema } from '@snowrealm/validation'
import { emitEvent } from '@snowrealm/analytics'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'
import { createSnapshotFromAsset } from '@/lib/design/snapshots'

export const dynamic = 'force-dynamic'

export const GET = handler(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const result = await resolveContext()
    if (!result.ok) {
      if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
      return fail('FORBIDDEN', '你沒有這個空間的存取權。')
    }
    const { ctx } = result
    const { id } = await params

    const { data, error } = await ctx.db
      .from('design_snapshots')
      .select('id, asset_id, external_version_id, extracted_features, created_at')
      .eq('design_file_id', id)
      .eq('space_id', ctx.spaceId)
      .order('created_at', { ascending: false })

    if (error) return fail('INTERNAL', '無法載入版本。')
    return ok(data ?? [])
  },
)

/** 上傳新版本：帶新的 assetId，系統建一筆新 snapshot。 */
export const POST = handler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const result = await resolveContext()
    if (!result.ok) {
      if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
      return fail('FORBIDDEN', '你沒有這個空間的存取權。')
    }
    const { ctx } = result
    const { id } = await params

    // 確認作品屬於本 space
    const { data: file } = await ctx.db
      .from('design_files')
      .select('id')
      .eq('id', id)
      .eq('space_id', ctx.spaceId)
      .is('deleted_at', null)
      .maybeSingle()
    if (!file) return fail('NOT_FOUND', '找不到這個作品。')

    const body: unknown = await request.json().catch(() => null)
    const parsed = snapshotCreateSchema.safeParse(body)
    if (!parsed.success) return failValidation(parsed.error)

    const snap = await createSnapshotFromAsset(ctx, id, parsed.data.assetId, parsed.data.externalVersionId)
    if (!snap.ok) {
      const messages: Record<string, string> = {
        asset_not_found: '找不到指定的檔案。',
        asset_not_ready: '這個檔案還在處理中，稍後再試。',
        duplicate: '這個版本已經存在了（內容相同）。',
        error: '建立版本時發生問題。',
      }
      const code = snap.reason === 'duplicate' ? 'CONFLICT' : 'UNPROCESSABLE'
      return fail(code, messages[snap.reason] ?? '無法建立版本。')
    }

    // design_file 有新版本 → 更新 updated_at（讓它排到列表前面）
    await ctx.db
      .from('design_files')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('space_id', ctx.spaceId)

    await emitEvent('design.synced', ctx.spaceId, ctx.userId, {
      designFileId: id,
      snapshotId: snap.snapshotId,
      provider: 'upload',
    })

    return ok({ snapshotId: snap.snapshotId }, undefined, 201)
  },
)
