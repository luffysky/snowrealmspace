import type { NextRequest } from 'next/server'
import { themeFromImageSchema } from '@snowrealm/validation'
import { draftsFromLocalFeatures, analyzeTheme, type LocalFeaturesInput } from '@snowrealm/theme-engine'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

/**
 * 從圖片生成主題草稿。v1.0 §7.3。
 *
 * ADR-012：**完全本地演算法，同步回傳，零成本。**
 * 色票已在上傳時由 asset.process 算好並存進 local_features，
 * 這裡只是讀出來組成主題 —— 所以能穩定在 3 秒內（v1.0 §42.1）。
 *
 * 不建立主題，只回傳草稿。使用者預覽後才決定要不要存。
 */
export const POST = handler(async (request: NextRequest) => {
  const result = await resolveContext()
  if (!result.ok) {
    if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
    return fail('FORBIDDEN', '你沒有這個空間的存取權。')
  }
  const { ctx } = result

  const body: unknown = await request.json().catch(() => null)
  const parsed = themeFromImageSchema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)
  const input = parsed.data

  const { data: asset } = await ctx.db
    .from('assets')
    .select('id, kind, status, local_features, original_filename')
    .eq('id', input.assetId)
    .eq('space_id', ctx.spaceId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!asset) return fail('NOT_FOUND', '找不到這張圖片。')
  if (asset.kind !== 'image') return fail('UNPROCESSABLE', '只能從圖片生成主題。')

  const baseName =
    input.baseName ?? (stripExtension(asset.original_filename ?? '') || '從圖片')

  const generated = draftsFromLocalFeatures(
    asset.local_features as LocalFeaturesInput | null,
    baseName,
    input.variants,
  )

  if (!generated) {
    /*
     * 分析尚未完成（沒有主色）。不編一個假的色票，但也不能只丟一個死錯誤 ——
     * 使用者剛上傳完就點「生成主題」是最自然的操作。
     * 標記 retryable 讓前端知道這是等待而非失敗，可以自己輪詢。
     */
    return fail('UNPROCESSABLE', '這張圖片還在分析中，請稍等幾秒。', { retryable: true })
  }

  // a11yReport 在儲存時才需要，這裡一併附上讓前端能立即顯示對比狀態
  const drafts = generated.drafts.map(({ variant, definition }) => ({
    variant,
    definition,
    a11yReport: analyzeTheme(definition),
  }))

  return ok({ assetId: asset.id, palette: generated.palette, drafts })
})

function stripExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, '').slice(0, 60)
}
