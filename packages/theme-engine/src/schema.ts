import { z } from 'zod'

/**
 * ThemeDefinition 的執行期驗證。
 *
 * ADR-020：主題可以用 JSON 匯入。這代表 definition 是**不可信輸入**，
 * 而它的值會被寫進 CSS 變數 —— 若不擋，主題檔就是 CSS 注入管道。
 *
 * 因此顏色只接受嚴格的 hex / rgba 格式，不接受任意 CSS 值。
 * `url(...)`、`expression(...)`、`</style>` 這類內容會在正則階段就被拒絕。
 */

const hex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, '必須是 #RRGGBB 格式')

const rgba = z
  .string()
  .regex(
    /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\)$/,
    '必須是 rgb() 或 rgba() 格式',
  )

/** 允許 hex 或 rgba —— 用於 surface / border 這類需要透明度的 token。 */
const colorWithAlpha = z.union([hex, rgba])

export const themeColorsSchema = z
  .object({
    primary: hex,
    secondary: hex,
    accent: hex,
    background: hex,
    surface: colorWithAlpha,
    surfaceAlt: colorWithAlpha,
    textPrimary: hex,
    textSecondary: hex,
    border: colorWithAlpha,
    success: hex,
    warning: hex,
    danger: hex,
    focusRing: hex,
  })
  .strict()

export const themeTypographySchema = z
  .object({
    headingFontId: z.string().min(1).max(64),
    bodyFontId: z.string().min(1).max(64),
    uiFontId: z.string().min(1).max(64),
    monoFontId: z.string().min(1).max(64).optional(),
    headingScale: z.number().min(0.8).max(2),
    bodyScale: z.number().min(0.75).max(1.5),
    lineHeight: z.number().min(1).max(2.4),
    letterSpacing: z.number().min(-0.05).max(0.3),
  })
  .strict()

export const themeSurfacesSchema = z
  .object({
    style: z.enum(['solid', 'glass', 'soft', 'outline']),
    opacity: z.number().min(0).max(1),
    blur: z.number().min(0).max(40),
    radius: z.number().min(0).max(48),
    borderWidth: z.number().min(0).max(4),
  })
  .strict()

export const themeEffectsSchema = z
  .object({
    shadow: z.enum(['none', 'soft', 'medium', 'dramatic']),
    glow: z.boolean(),
    noise: z.boolean(),
  })
  .strict()

export const themeMotionSchema = z
  .object({
    preset: z.enum(['none', 'soft', 'float', 'playful', 'cinematic']),
    intensity: z.number().min(0).max(1),
    reduceMotionFallback: z.boolean(),
  })
  .strict()

export const themeDefinitionSchema = z
  .object({
    schemaVersion: z.literal(1),
    name: z.string().min(1).max(80),
    colors: themeColorsSchema,
    typography: themeTypographySchema,
    surfaces: themeSurfacesSchema,
    effects: themeEffectsSchema,
    motion: themeMotionSchema,
    backgroundPlaylistId: z.string().uuid().optional(),
  })
  .strict()

/** 匯出檔的外層格式（ADR-020 §6.2）。 */
export const themeExportSchema = z
  .object({
    format: z.literal('snowrealm-theme'),
    schemaVersion: z.literal(1),
    exportedAt: z.string(),
    name: z.string().min(1).max(80),
    definition: themeDefinitionSchema,
    fontRefs: z
      .array(
        z.object({
          id: z.string(),
          family: z.string(),
          slug: z.string(),
        }),
      )
      .max(8)
      .default([]),
  })
  .strict()

export type ThemeExport = z.infer<typeof themeExportSchema>
