import { z } from 'zod'
import { themeDefinitionSchema, themeExportSchema } from '@snowrealm/theme-engine'

/**
 * 主題 API 的輸入驗證。
 *
 * definition 的驗證委派給 theme-engine 的 schema ——
 * 那裡是唯一定義處，且已包含 ADR-020 的注入防護。
 */

export const themeCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    definition: themeDefinitionSchema,
    source: z.enum(['manual', 'from_image', 'from_mood', 'imported', 'preset']).default('manual'),
    sourceAssetId: z.string().uuid().nullable().optional(),
  })
  .strict()

export const themePatchSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    definition: themeDefinitionSchema.optional(),
    isFavorite: z.boolean().optional(),
  })
  .strict()

export const themeFromImageSchema = z
  .object({
    assetId: z.string().uuid(),
    variants: z.number().int().min(1).max(5).default(3),
    baseName: z.string().trim().min(1).max(60).optional(),
  })
  .strict()

/** 匯入的整包 JSON。格式錯誤或含注入內容都會在這裡被擋下。 */
export const themeImportSchema = themeExportSchema

export const contrastCheckSchema = z
  .object({
    pairs: z
      .array(
        z.object({
          fg: z.string().max(64),
          bg: z.string().max(64),
          size: z.enum(['normal', 'large', 'ui']).default('normal'),
          label: z.string().max(80).optional(),
        }),
      )
      .min(1)
      .max(40),
  })
  .strict()

export type ThemeCreateInput = z.infer<typeof themeCreateSchema>
export type ThemePatchInput = z.infer<typeof themePatchSchema>
