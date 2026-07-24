import { buildThemesFromPalette } from './palette.js'
import { NEUTRAL } from './presets.js'
import type { Palette } from './palette.js'
import type { ThemeDefinition } from './types.js'

/**
 * 從 asset 的 local_features（巢狀，見 asset-process.ts）產生主題草稿。
 *
 * 這是 /api/themes/from-image 的核心映射，抽成純函式讓它可被單元測試 ——
 * route 只負責讀 DB 與加 a11yReport。ADR-012：完全本地、可重現、零成本。
 *
 * 回傳 null 表示分析尚未完成（沒有主色），呼叫端應告訴使用者稍候再試，
 * 而不是編一個假色票。
 */

export type LocalFeaturesInput = {
  colors?: {
    dominant?: string
    secondary?: string
    accent?: string
    darkest?: string
    lightest?: string
    palette?: { color: string; weight: number }[]
  }
}

export type ThemeDraft = { variant: string; definition: ThemeDefinition }

export function draftsFromLocalFeatures(
  features: LocalFeaturesInput | null | undefined,
  baseName = '從圖片',
  variants = 3,
): { palette: Palette; drafts: ThemeDraft[] } | null {
  const colors = features?.colors
  if (!colors?.dominant) return null

  const palette: Palette = {
    dominant: colors.dominant,
    secondary: colors.secondary ?? colors.dominant,
    accent: colors.accent ?? colors.dominant,
    darkest: colors.darkest ?? NEUTRAL.nearBlack,
    lightest: colors.lightest ?? NEUTRAL.white,
    swatches: colors.palette ?? [],
    stats: { colorCount: 0, averageSaturation: 0, averageLightness: 0, isDark: false },
  }

  const drafts = buildThemesFromPalette(palette, baseName)
    .slice(0, Math.max(1, variants))
    .map(({ definition, variant }) => ({ variant, definition }))

  return { palette, drafts }
}
