import type { NextRequest } from 'next/server'
import { z } from 'zod'
import {
  completeForUsage,
  QuotaExceededError,
  AllCandidatesFailedError,
  type AIContentBlock,
} from '@snowrealm/ai-core'
import { storage } from '@snowrealm/storage'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'
import { buildCompleteDeps } from '@/lib/ai/deps'

export const dynamic = 'force-dynamic'

const schema = z.object({ snapshotId: z.string().uuid(), deep: z.boolean().optional() }).strict()

const SYSTEM = `你是溫暖、專業的設計顧問。看使用者的設計圖，給具體、可行、鼓勵性的回饋。
用繁體中文，條列 3–5 點，可涵蓋：構圖與視覺層次、配色、留白與節奏、文字可讀性。
只根據你「真的看到」的東西講，不編造；不確定就說不確定。語氣像朋友，不要打分數、不要說教。`

/**
 * 設計視覺分析（design_vision_light / deep）。複用多模態管線：讀作品快照的圖 → vision 模型看圖給回饋。
 * graceful：沒金鑰或全部候選失敗 → AI_UNAVAILABLE，不生成假結果（§46.2）。
 */
export const POST = handler(async (request: NextRequest) => {
  const result = await resolveContext()
  if (!result.ok) return fail(result.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '沒有存取權。')
  const { ctx } = result
  const body: unknown = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)

  // snapshot → 驗證屬於本 space → asset 圖片位元組
  const { data: snap } = await ctx.db
    .from('design_snapshots')
    .select('asset_id, design_file_id')
    .eq('id', parsed.data.snapshotId)
    .eq('space_id', ctx.spaceId)
    .maybeSingle()
  if (!snap) return fail('NOT_FOUND', '找不到這個版本。')

  const { data: asset } = await ctx.db
    .from('assets')
    .select('storage_key, mime_type, kind, bytes')
    .eq('id', snap.asset_id)
    .eq('space_id', ctx.spaceId)
    .maybeSingle()
  if (!asset || asset.kind !== 'image') return fail('UNPROCESSABLE', '只能分析圖片作品。')
  if (asset.bytes > 8 * 1024 * 1024) return fail('UNPROCESSABLE', '圖片太大，無法分析（上限 8MB）。')

  let base64: string
  try {
    base64 = Buffer.from(await storage().get(asset.storage_key)).toString('base64')
  } catch {
    return fail('INTERNAL', '讀不到圖片。')
  }

  const { data: space } = await ctx.db.from('spaces').select('timezone').eq('id', ctx.spaceId).maybeSingle()
  const tz = space?.timezone ?? 'Asia/Taipei'
  const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date())
  const deps = await buildCompleteDeps(ctx.spaceId, localDate, ctx.userId)

  const image: AIContentBlock = { type: 'image', mediaType: asset.mime_type, data: base64 }

  try {
    const completion = await completeForUsage(
      parsed.data.deep ? 'design_vision_deep' : 'design_vision_light',
      {
        spaceId: ctx.spaceId,
        system: SYSTEM,
        user: [
          {
            role: 'user',
            content: [{ type: 'text', text: '請看看這張設計，給我一些回饋。' }, image],
          },
        ],
      },
      deps,
    )
    return ok({
      analysis: completion.text,
      model: completion.model,
      isFree: completion.isFree,
      deep: Boolean(parsed.data.deep),
    })
  } catch (err) {
    if (err instanceof QuotaExceededError) return fail('AI_QUOTA_EXCEEDED', err.message)
    if (err instanceof AllCandidatesFailedError) {
      return fail('AI_UNAVAILABLE', 'AI 暫時無法分析（可能尚未設定金鑰），請稍後再試。')
    }
    console.error('[design.vision] 未預期錯誤', (err as Error).message)
    return fail('INTERNAL', '分析時發生問題，請重試。')
  }
})
