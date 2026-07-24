import { createAdminClient } from '@snowrealm/db/server'
import type { ApiContext } from '@/lib/api/context'

/**
 * 從一個 asset 建立 design_snapshot（作品的一個版本）。
 *
 * snapshot 代表版本，不該被使用者偽造 —— RLS 只給成員 SELECT，
 * 因此寫入走 service role（像 asset_renditions 一樣是系統控制的衍生列）。
 * 呼叫端必須已經用 resolveContext 驗證過成員身分。
 *
 * checksum 沿用 asset 的 checksum：unique(design_file_id, checksum) 讓「同一張圖
 * 重複加成同一作品的版本」被擋下（回 duplicate），符合 §3.4 的去重語意。
 * extracted_features 複製 asset 當下的 local_features，讓版本的數值被凍結。
 */
export type SnapshotResult =
  | { ok: true; snapshotId: string }
  | { ok: false; reason: 'asset_not_found' | 'asset_not_ready' | 'duplicate' | 'error' }

export async function createSnapshotFromAsset(
  ctx: ApiContext,
  designFileId: string,
  assetId: string,
  externalVersionId?: string,
): Promise<SnapshotResult> {
  // 受 RLS 約束的讀取：不是本 space 的 asset 就查不到
  const { data: asset } = await ctx.db
    .from('assets')
    .select('id, checksum, status, local_features')
    .eq('id', assetId)
    .eq('space_id', ctx.spaceId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!asset) return { ok: false, reason: 'asset_not_found' }
  if (asset.status !== 'ready') return { ok: false, reason: 'asset_not_ready' }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('design_snapshots')
    .insert({
      space_id: ctx.spaceId,
      design_file_id: designFileId,
      asset_id: asset.id,
      checksum: asset.checksum,
      extracted_features: (asset.local_features ?? {}) as never,
      external_version_id: externalVersionId ?? null,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return { ok: false, reason: 'duplicate' }
    console.error('[design] snapshot 建立失敗', error.message)
    return { ok: false, reason: 'error' }
  }
  return { ok: true, snapshotId: data.id }
}
