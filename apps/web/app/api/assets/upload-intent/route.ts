import type { NextRequest } from 'next/server'
import { uploadIntentSchema, kindForMime, LIMITS } from '@snowrealm/validation'
import { storage, storageKeys } from '@snowrealm/storage'
import { createAdminClient } from '@snowrealm/db/server'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

/**
 * 上傳三段流程的第一段。見 docs/spec/02-domain-model.md §5.1。
 *
 *   1. upload-intent  ← 這裡：檢查配額、去重、發 signed PUT URL
 *   2. client → R2    直傳，不經過我們的伺服器
 *   3. complete       驗證實際內容、標記 ready、入列處理
 */
export const POST = handler(async (request: NextRequest) => {
  const result = await resolveContext()
  if (!result.ok) {
    if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
    if (result.reason === 'missing_space') return fail('VALIDATION_FAILED', '缺少空間識別。')
    return fail('FORBIDDEN', '你沒有這個空間的存取權。')
  }
  const { ctx } = result

  const body: unknown = await request.json().catch(() => null)
  const parsed = uploadIntentSchema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)

  const input = parsed.data
  const kind = kindForMime(input.mimeType)
  if (!kind) return fail('UNSUPPORTED_MEDIA_TYPE', '不支援的檔案類型。')

  const admin = createAdminClient()

  // ── 去重：同 space 內相同內容直接複用（02-domain-model.md §3.1）──
  const { data: existing } = await admin
    .from('assets')
    .select('id, storage_key, bytes')
    .eq('space_id', ctx.spaceId)
    .eq('checksum', input.checksum)
    .eq('status', 'ready')
    .is('deleted_at', null)
    .maybeSingle()

  if (existing) {
    return ok({ assetId: existing.id, deduplicated: true })
  }

  // ── 配額：用 DB 函式計算，避免併發上傳各自讀到舊值 ──
  const { data: usedBytes, error: quotaError } = await admin.rpc('space_storage_bytes', {
    target_space_id: ctx.spaceId,
  })
  if (quotaError) {
    console.error('[upload-intent] 配額查詢失敗', quotaError.message)
    return fail('INTERNAL', '無法確認儲存空間，請稍後再試。')
  }

  const used = Number(usedBytes ?? 0)
  if (used + input.bytes > LIMITS.spaceTotal) {
    return fail('QUOTA_EXCEEDED', '儲存空間不足。請先刪除一些檔案。', {
      used,
      limit: LIMITS.spaceTotal,
      requested: input.bytes,
    })
  }

  // ── 建立 pending asset ──
  const { data: asset, error: insertError } = await admin
    .from('assets')
    .insert({
      space_id: ctx.spaceId,
      created_by: ctx.userId,
      kind,
      mime_type: input.mimeType,
      bytes: input.bytes,
      checksum: input.checksum,
      // storage_key 需要 asset id，先放暫時值再更新
      storage_key: `pending/${ctx.spaceId}/${input.checksum}-${Date.now()}`,
      original_filename: input.filename.slice(0, 255),
      status: 'pending',
    })
    .select('id')
    .single()

  if (insertError || !asset) {
    console.error('[upload-intent] 建立 asset 失敗', insertError?.message)
    return fail('INTERNAL', '無法建立上傳，請稍後再試。')
  }

  const storageKey = storageKeys.assetOriginal(ctx.userId, ctx.spaceId, asset.id)
  await admin.from('assets').update({ storage_key: storageKey }).eq('id', asset.id)

  const intent = await storage().createUploadUrl({
    key: storageKey,
    contentType: input.mimeType,
    contentLength: input.bytes,
  })

  return ok({
    assetId: asset.id,
    uploadUrl: intent.url,
    headers: intent.requiredHeaders,
    expiresAt: intent.expiresAt.toISOString(),
    deduplicated: false,
  })
})
