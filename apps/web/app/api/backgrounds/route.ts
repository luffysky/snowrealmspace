import type { NextRequest } from 'next/server'
import { backgroundCreateSchema } from '@snowrealm/validation'
import { emitEvent } from '@snowrealm/analytics'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

export const GET = handler(async () => {
  const result = await resolveContext()
  if (!result.ok) {
    if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
    return fail('FORBIDDEN', '你沒有這個空間的存取權。')
  }
  const { ctx } = result

  const { data, error } = await ctx.db
    .from('background_items')
    .select('*')
    .eq('space_id', ctx.spaceId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('[backgrounds] 查詢失敗', error.message)
    return fail('INTERNAL', '無法載入背景。')
  }
  return ok(data ?? [])
})

export const POST = handler(async (request: NextRequest) => {
  const result = await resolveContext()
  if (!result.ok) {
    if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
    return fail('FORBIDDEN', '你沒有這個空間的存取權。')
  }
  const { ctx } = result

  const body: unknown = await request.json().catch(() => null)
  const parsed = backgroundCreateSchema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)
  const input = parsed.data

  // 引用的 asset 必須屬於同一個 space（RLS 會擋，但錯誤訊息要說得清楚）
  let derivedName: string | null = null

  if (input.assetId) {
    const { data: asset } = await ctx.db
      .from('assets')
      .select('id, kind, original_filename')
      .eq('id', input.assetId)
      .eq('space_id', ctx.spaceId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!asset) return fail('NOT_FOUND', '找不到這個檔案。')
    if (input.type === 'image' && asset.kind !== 'image') {
      return fail('UNPROCESSABLE', '這個檔案不是圖片。')
    }
    if (input.type === 'video' && asset.kind !== 'video') {
      return fail('UNPROCESSABLE', '這個檔案不是影片。')
    }

    // 沒給名稱時用來源檔名。否則使用者有五個背景時會看到五個「圖片背景」，
    // 完全分不出哪個是哪個。
    derivedName = asset.original_filename?.replace(/\.[^.]+$/, '')?.slice(0, 80) ?? null
  }

  const { data, error } = await ctx.db
    .from('background_items')
    .insert({
      space_id: ctx.spaceId,
      created_by: ctx.userId,
      asset_id: input.assetId ?? null,
      type: input.type,
      name: input.name ?? derivedName,
      fit: input.fit,
      position_x: input.positionX,
      position_y: input.positionY,
      zoom: input.zoom,
      blur: input.blur,
      brightness: input.brightness,
      contrast: input.contrast,
      saturation: input.saturation,
      overlay_color: input.overlayColor,
      overlay_opacity: input.overlayOpacity,
      loop: input.loop,
      // ADR-019 偏離（Luffy）：影片可選聲音；預設仍靜音（autoplay 政策）
      muted: input.muted,
      glass_enabled: input.glassEnabled,
      glass_blur: input.glassBlur,
      glass_opacity: input.glassOpacity,
      glass_radius: input.glassRadius,
      glass_color: input.glassColor,
      crop_x: input.cropX,
      crop_y: input.cropY,
      crop_w: input.cropW,
      crop_h: input.cropH,
      gradient_spec: (input.gradientSpec ?? null) as never,
      procedural_id: input.proceduralId ?? null,
    })
    .select('*')
    .single()

  if (error || !data) {
    console.error('[backgrounds] 建立失敗', error?.message)
    return fail('INTERNAL', '無法建立背景。')
  }

  await emitEvent('background.added', ctx.spaceId, ctx.userId, {
    backgroundItemId: data.id,
    assetId: input.assetId ?? null,
    type: input.type,
  })

  return ok(data, undefined, 201)
})
