import type { NextRequest } from 'next/server'
import { sniffMimeType, mimeMatches, kindForMime } from '@snowrealm/validation'
import { storage } from '@snowrealm/storage'
import { createAdminClient } from '@snowrealm/db/server'
import { emitEvent } from '@snowrealm/analytics'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, handler } from '@/lib/api/respond'
import { enqueue } from '@/lib/api/queue'

export const dynamic = 'force-dynamic'

/**
 * 上傳三段流程的第三段：驗證實際上傳的內容。
 *
 * **這一步是安全關鍵。**
 * 前一步收到的 mimeType 與 bytes 都是 client 宣稱的值。
 * 這裡從 R2 讀回真實的物件並比對 —— 不符就標記失敗並刪除檔案。
 */
export const POST = handler(
  async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const result = await resolveContext()
    if (!result.ok) {
      if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
      return fail('FORBIDDEN', '你沒有這個空間的存取權。')
    }
    const { ctx } = result
    const { id } = await params

    const admin = createAdminClient()
    const { data: asset } = await admin
      .from('assets')
      .select('id, space_id, storage_key, mime_type, bytes, kind, status')
      .eq('id', id)
      .maybeSingle()

    if (!asset || asset.space_id !== ctx.spaceId) {
      return fail('NOT_FOUND', '找不到這個檔案。')
    }
    // 重複呼叫視為成功（客戶端可能重試）
    if (asset.status === 'ready') return ok({ assetId: asset.id, status: 'ready' })
    if (asset.status === 'failed') {
      return fail('UNPROCESSABLE', '這個上傳已失敗，請重新上傳。')
    }

    async function reject(reason: string, message: string) {
      await admin
        .from('assets')
        .update({ status: 'failed', failure_reason: reason })
        .eq('id', id)
      // 檔案已經在 R2 上但不合法，立即刪除而不是等 GC
      await storage().delete(asset!.storage_key).catch(() => {})
      return fail('UNPROCESSABLE', message)
    }

    // ── 物件真的存在嗎？ ──
    const head = await storage().head(asset.storage_key)
    if (!head) {
      return await reject('missing_object', '找不到上傳的檔案，請重新上傳。')
    }

    // ── 實際大小與宣稱是否一致 ──
    if (head.bytes !== asset.bytes) {
      return await reject(
        'size_mismatch',
        `檔案大小與宣稱不符（宣稱 ${asset.bytes}，實際 ${head.bytes}）。`,
      )
    }

    // ── 用檔案內容偵測真實 MIME，不信任宣稱值 ──
    const bytes = await storage().get(asset.storage_key)
    const sniffed = sniffMimeType(bytes.subarray(0, 32))

    if (!sniffed) {
      return await reject('unknown_format', '無法辨識這個檔案的格式。')
    }
    if (!mimeMatches(asset.mime_type, sniffed)) {
      return await reject(
        'mime_mismatch',
        `檔案內容與副檔名不符（宣稱 ${asset.mime_type}，實際 ${sniffed}）。`,
      )
    }
    if (kindForMime(sniffed) === null) {
      return await reject('unsupported', '不支援的檔案類型。')
    }

    // sniff 認得容器但分不出音訊/視訊：同容器家族且 client 宣稱音訊時，保留宣稱值
    // （否則 audio/webm 會被覆寫成 video/webm，與 kind='audio' 不一致）。
    // 其餘一律用 sniff 出的規範值覆寫 client（防謊報，例如 image/jpg → image/jpeg）。
    const canonicalMime =
      asset.mime_type !== sniffed &&
      mimeMatches(asset.mime_type, sniffed) &&
      kindForMime(asset.mime_type) === 'audio'
        ? asset.mime_type
        : sniffed

    // ── 通過。標記就緒並排入處理 ──
    const { error: updateError } = await admin
      .from('assets')
      .update({ status: 'ready', mime_type: canonicalMime })
      .eq('id', id)

    if (updateError) {
      console.error('[complete] 更新失敗', updateError.message)
      return fail('INTERNAL', '無法完成上傳，請稍後再試。')
    }

    await enqueue('asset.process', { assetId: id, spaceId: ctx.spaceId })

    await emitEvent('asset.uploaded', ctx.spaceId, ctx.userId, {
      assetId: id,
      kind: asset.kind,
      bytes: asset.bytes,
      deduplicated: false,
    })

    return ok({ assetId: id, status: 'ready', mimeType: sniffed })
  },
)
