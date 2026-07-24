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
    gradientSpec: gradientSpecSchema.optional(),
  })
  .strict()

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
