import { z } from 'zod'
import { NEUTRAL } from '@snowrealm/theme-engine'

/**
 * 背景與幻燈片。見 docs/spec/04-api-contract.md §4、02-domain-model.md §3.5。
 *
 * ADR-005：background_item 不存位元組，只存「把某個 asset 當背景呈現」的設定。
 */

export const backgroundTypeSchema = z.enum(['image', 'video', 'gradient', 'procedural'])

/** 漸層規格。只接受結構化資料，不接受 CSS 字串 —— 那會是注入管道。 */
export const gradientSpecSchema = z
  .object({
    kind: z.enum(['linear', 'radial']),
    angle: z.number().min(0).max(360).default(180),
    stops: z
      .array(
        z.object({
          color: z.string().regex(/^#[0-9a-fA-F]{6}$/, '必須是 #RRGGBB'),
          position: z.number().min(0).max(100),
        }),
      )
      .min(2)
      .max(6),
  })
  .strict()

const presentationFields = {
  name: z.string().trim().max(80).nullable().optional(),
  fit: z.enum(['cover', 'contain', 'original']).default('cover'),
  positionX: z.number().min(0).max(100).default(50),
  positionY: z.number().min(0).max(100).default(50),
  zoom: z.number().min(0.5).max(4).default(1),
  blur: z.number().min(0).max(40).default(0),
  brightness: z.number().min(0.2).max(2).default(1),
  contrast: z.number().min(0.2).max(2).default(1),
  saturation: z.number().min(0).max(2).default(1),
  overlayColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default(NEUTRAL.black),
  overlayOpacity: z.number().min(0).max(1).default(0),
  loop: z.boolean().default(true),
  // ADR-019 偏離（Luffy）：背景影片可選聲音。預設仍靜音（autoplay 政策要求），
  // 使用者要出聲需在播放時手動取消靜音。
  muted: z.boolean().default(true),
  // 霧面玻璃層（Luffy）：疊在背景上的一層毛玻璃面板。
  glassEnabled: z.boolean().default(false),
  glassBlur: z.number().min(0).max(60).default(12),
  glassOpacity: z.number().min(0).max(1).default(0.3),
  glassRadius: z.number().min(0).max(64).default(16),
  glassColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default(NEUTRAL.white),
  // 非破壞性裁切矩形（百分比，左上角 + 寬高）。預設整張。
  cropX: z.number().min(0).max(100).default(0),
  cropY: z.number().min(0).max(100).default(0),
  cropW: z.number().min(0).max(100).default(100),
  cropH: z.number().min(0).max(100).default(100),
  // 疊加場景（雪/雨/櫻花…）：任何背景之上都能疊一層。
  sceneId: z.string().max(40).nullable().optional(),
  sceneDensity: z.number().min(0.1).max(3).default(1),
}

/** 裁切矩形不得超出邊界（起點 + 寬 ≤ 100）。給 create/patch 兩邊共用。 */
function refineCropBounds(
  val: {
    cropX?: number | undefined
    cropY?: number | undefined
    cropW?: number | undefined
    cropH?: number | undefined
  },
  ctx: z.RefinementCtx,
) {
  const x = val.cropX ?? 0
  const y = val.cropY ?? 0
  const w = val.cropW ?? 100
  const h = val.cropH ?? 100
  if (x + w > 100.0001) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cropW'], message: '裁切超出右邊界' })
  }
  if (y + h > 100.0001) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cropH'], message: '裁切超出下邊界' })
  }
}

export const backgroundCreateSchema = z
  .object({
    type: backgroundTypeSchema,
    assetId: z.string().uuid().nullable().optional(),
    gradientSpec: gradientSpecSchema.nullable().optional(),
    proceduralId: z.string().max(60).nullable().optional(),
    ...presentationFields,
  })
  .strict()
  .superRefine((val, ctx) => {
    // 型別與來源必須一致，否則會在渲染時才發現
    if ((val.type === 'image' || val.type === 'video') && !val.assetId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['assetId'],
        message: '圖片或影片背景必須指定檔案',
      })
    }
    if (val.type === 'gradient' && !val.gradientSpec) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['gradientSpec'],
        message: '漸層背景必須提供漸層設定',
      })
    }
    if (val.type === 'procedural' && !val.proceduralId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['proceduralId'],
        message: '程式動畫背景必須指定類型',
      })
    }
    refineCropBounds(val, ctx)
  })

export const backgroundPatchSchema = z
  .object({
    name: z.string().trim().max(80).nullable().optional(),
    fit: z.enum(['cover', 'contain', 'original']).optional(),
    positionX: z.number().min(0).max(100).optional(),
    positionY: z.number().min(0).max(100).optional(),
    zoom: z.number().min(0.5).max(4).optional(),
    blur: z.number().min(0).max(40).optional(),
    brightness: z.number().min(0.2).max(2).optional(),
    contrast: z.number().min(0.2).max(2).optional(),
    saturation: z.number().min(0).max(2).optional(),
    overlayColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    overlayOpacity: z.number().min(0).max(1).optional(),
    loop: z.boolean().optional(),
    muted: z.boolean().optional(),
    glassEnabled: z.boolean().optional(),
    glassBlur: z.number().min(0).max(60).optional(),
    glassOpacity: z.number().min(0).max(1).optional(),
    glassRadius: z.number().min(0).max(64).optional(),
    glassColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    cropX: z.number().min(0).max(100).optional(),
    cropY: z.number().min(0).max(100).optional(),
    cropW: z.number().min(0).max(100).optional(),
    cropH: z.number().min(0).max(100).optional(),
    sceneId: z.string().max(40).nullable().optional(),
    sceneDensity: z.number().min(0.1).max(3).optional(),
    gradientSpec: gradientSpecSchema.optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    // 只有四個裁切值都在同一次 patch 才好完整驗；部分 patch 交給 DB 的 bg_crop_bounds 約束擋。
    if (
      val.cropX !== undefined &&
      val.cropY !== undefined &&
      val.cropW !== undefined &&
      val.cropH !== undefined
    ) {
      refineCropBounds(val, ctx)
    }
  })

export const playModeSchema = z.enum([
  'sequential',
  'random',
  'per_login',
  'daily',
  'hourly',
  'time_of_day',
  'day_of_week',
  'per_project',
  'manual',
])

/** Birthday Alpha 只做三種轉場（v1.0 §12.4）。其餘在 schema 中保留但未實作。 */
export const transitionSchema = z.enum([
  'fade',
  'blur_fade',
  'zoom_fade',
  'slide',
  'dissolve',
  'parallax',
  'page_turn',
  'cinematic_wipe',
  'pixel',
])

export const ALPHA_TRANSITIONS = ['fade', 'blur_fade', 'zoom_fade'] as const

/** v1.0 §12.7 的時段排程。以 space 時區計算，不是 UTC。 */
export const scheduleSchema = z
  .object({
    slots: z
      .array(
        z.object({
          /** 24 小時制，含起不含迄 */
          startHour: z.number().int().min(0).max(23),
          endHour: z.number().int().min(0).max(24),
          backgroundItemId: z.string().uuid(),
          label: z.string().max(40).optional(),
        }),
      )
      .max(8)
      .default([]),
  })
  .strict()

export const playlistCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    playMode: playModeSchema.default('sequential'),
    intervalSeconds: z.number().int().min(5).max(86400).default(900),
    transition: transitionSchema.default('fade'),
    transitionMs: z.number().int().min(0).max(5000).default(800),
    schedule: scheduleSchema.optional(),
  })
  .strict()

export const playlistPatchSchema = playlistCreateSchema.partial().strict()

export const playlistItemsSchema = z
  .object({
    backgroundItemIds: z.array(z.string().uuid()).min(1).max(200),
  })
  .strict()

export const reorderSchema = z
  .object({
    orderedItemIds: z.array(z.string().uuid()).min(1).max(200),
  })
  .strict()

export type BackgroundCreateInput = z.infer<typeof backgroundCreateSchema>
export type PlaylistCreateInput = z.infer<typeof playlistCreateSchema>
export type GradientSpec = z.infer<typeof gradientSpecSchema>
export type ScheduleSpec = z.infer<typeof scheduleSchema>
