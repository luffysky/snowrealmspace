import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { storage } from '@snowrealm/storage'
import { createAdminClient } from '@snowrealm/db/server'
import { ok, fail, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

/**
 * 公開資產簽名 URL（anon）。
 *
 * 安全：**先驗證** snapshot 的 parent 作品是 public/unlisted 且未刪除，才簽 URL。
 * 不重用受權的 /api/assets/[id]/url（那條要求登入且 RLS 綁成員）。
 * 只吐該作品當前快照指向的圖片，簽名 15 分鐘。
 */
export const GET = handler(async (request: NextRequest) => {
  const parsed = z.string().uuid().safeParse(new URL(request.url).searchParams.get('snapshot'))
  if (!parsed.success) return fail('VALIDATION_FAILED', 'snapshot 參數不正確。')

  const admin = createAdminClient()

  const { data: snap } = await admin
    .from('design_snapshots')
    .select('asset_id, design_file_id')
    .eq('id', parsed.data)
    .maybeSingle()
  if (!snap) return fail('NOT_FOUND', '找不到這張圖。')

  const { data: file } = await admin
    .from('design_files')
    .select('visibility, deleted_at')
    .eq('id', snap.design_file_id)
    .maybeSingle()
  if (!file || file.deleted_at || (file.visibility !== 'public' && file.visibility !== 'unlisted')) {
    return fail('NOT_FOUND', '這件作品未公開。')
  }

  const { data: asset } = await admin
    .from('assets')
    .select('storage_key, mime_type')
    .eq('id', snap.asset_id)
    .maybeSingle()
  if (!asset) return fail('NOT_FOUND', '找不到圖片。')

  const url = await storage().createDownloadUrl({ key: asset.storage_key })
  return ok({ url, mimeType: asset.mime_type, expiresInSeconds: 900 })
})
