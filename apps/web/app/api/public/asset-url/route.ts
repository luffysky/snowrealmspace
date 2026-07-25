import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { storage } from '@snowrealm/storage'
import { createAdminClient } from '@snowrealm/db/server'
import { ok, fail, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

/**
 * 公開資產簽名 URL（anon）。兩種授權：
 *   1. ?snapshot=<id>            → 只給 public/unlisted 作品的圖
 *   2. ?snapshot=<id>&token=<t>  → 分享連結授權：token 有效（未撤銷/未過期）且 snapshot
 *                                  屬於該連結指向的作品，就算作品是 private 也給（token 即授權）
 *
 * 一律先驗證再簽 URL，簽名 15 分鐘。不重用受權的 /api/assets/[id]/url。
 */
export const GET = handler(async (request: NextRequest) => {
  const url = new URL(request.url)
  const snapParsed = z.string().uuid().safeParse(url.searchParams.get('snapshot'))
  if (!snapParsed.success) return fail('VALIDATION_FAILED', 'snapshot 參數不正確。')
  const token = url.searchParams.get('token')

  const admin = createAdminClient()

  const { data: snap } = await admin
    .from('design_snapshots')
    .select('asset_id, design_file_id')
    .eq('id', snapParsed.data)
    .maybeSingle()
  if (!snap) return fail('NOT_FOUND', '找不到這張圖。')

  let allowed = false
  if (token) {
    // 分享連結授權：token → 指向的作品，且 snapshot 屬於它
    const { data: link } = await admin
      .from('share_links')
      .select('design_file_id, expires_at, revoked_at')
      .eq('token', token)
      .maybeSingle()
    if (
      link &&
      !link.revoked_at &&
      (!link.expires_at || new Date(link.expires_at) > new Date()) &&
      link.design_file_id === snap.design_file_id
    ) {
      allowed = true
    }
  }
  if (!allowed) {
    // 公開授權：作品必須 public/unlisted 且未刪除
    const { data: file } = await admin
      .from('design_files')
      .select('visibility, deleted_at')
      .eq('id', snap.design_file_id)
      .maybeSingle()
    if (file && !file.deleted_at && (file.visibility === 'public' || file.visibility === 'unlisted')) {
      allowed = true
    }
  }
  if (!allowed) return fail('NOT_FOUND', '這張圖未公開。')

  const { data: asset } = await admin
    .from('assets')
    .select('storage_key, mime_type')
    .eq('id', snap.asset_id)
    .maybeSingle()
  if (!asset) return fail('NOT_FOUND', '找不到圖片。')

  const dl = await storage().createDownloadUrl({ key: asset.storage_key })
  return ok({ url: dl, mimeType: asset.mime_type, expiresInSeconds: 900 })
})
