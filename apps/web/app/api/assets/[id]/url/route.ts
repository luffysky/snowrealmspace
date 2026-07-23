import type { NextRequest } from 'next/server'
import { storage } from '@snowrealm/storage'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

/**
 * 產生短期讀取 URL（ADR-022：15 分鐘）。
 *
 * bucket 是 private 的，所有讀取都必須經過這裡 ——
 * 這樣「使用者是否有權看這個檔案」才會被 RLS 檢查到。
 */
export const GET = handler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const result = await resolveContext()
    if (!result.ok) return fail('UNAUTHENTICATED', '請先登入。')
    const { ctx } = result
    const { id } = await params

    const rendition = request.nextUrl.searchParams.get('rendition')

    // 用受 RLS 約束的 client 查 —— 不是成員就查不到
    const { data: asset } = await ctx.db
      .from('assets')
      .select('id, storage_key, mime_type')
      .eq('id', id)
      .eq('space_id', ctx.spaceId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!asset) return fail('NOT_FOUND', '找不到這個檔案。')

    let key = asset.storage_key
    if (rendition) {
      const { data: r } = await ctx.db
        .from('asset_renditions')
        .select('storage_key')
        .eq('asset_id', id)
        .eq('role', rendition)
        .maybeSingle()
      // 衍生檔還沒產生好時退回原檔，而不是回 404 ——
      // 使用者剛上傳完就該看得到東西
      if (r) key = r.storage_key
    }

    const url = await storage().createDownloadUrl({ key })
    return ok({ url, expiresInSeconds: 900, mimeType: asset.mime_type })
  },
)
