import { parseColor } from './color.js'

/**
 * 版本比較的本地數值計算（ADR-012：只放可計算、可重現的數值）。
 *
 * 輸入是 asset 的 local_features（由 asset.process 的本地分析回填）。
 * 純函式、無隨機、無 IO —— 同樣的兩份 features 永遠得到同樣的差異數值，
 * 這是「版本比較」可信的前提。文字摘要屬 AI（Milestone D），這裡不做。
 */

/**
 * asset.process 寫入的 local_features 結構（巢狀）。見 asset-process.ts。
 * snapshot 的 extracted_features 直接複製這份，所以比較讀的是同一個形狀。
 */
export type LocalFeatures = {
  colors?: {
    dominant?: string
    secondary?: string
    accent?: string
    darkest?: string
    lightest?: string
  }
  composition?: {
    whitespaceRatio?: number
    averageSaturation?: number
    averageLightness?: number
    isDark?: boolean
  }
  dimensions?: { width?: number | null; height?: number | null; aspectRatio?: number | null }
}

export type ColorDiff = { from: string | null; to: string | null; distance: number | null }

export type FeatureComparison = {
  dimensions: {
    widthDelta: number | null
    heightDelta: number | null
    aspectRatioDelta: number | null
  }
  colors: {
    dominant: ColorDiff
    accent: ColorDiff
    darkest: ColorDiff
    lightest: ColorDiff
  }
  stats: {
    whitespaceDelta: number | null
    saturationDelta: number | null
    lightnessDelta: number | null
    isDarkChanged: boolean | null
  }
}

/** RGB 空間的歐氏距離，正規化成 0–100（0 = 完全相同）。 */
export function colorDistance(a: string | undefined, b: string | undefined): number | null {
  if (!a || !b) return null
  const ca = parseColor(a)
  const cb = parseColor(b)
  if (!ca || !cb) return null
  const d = Math.sqrt((ca.r - cb.r) ** 2 + (ca.g - cb.g) ** 2 + (ca.b - cb.b) ** 2)
  // 最大距離 = sqrt(255^2 * 3) ≈ 441.67
  return Math.round((d / 441.6729559300637) * 1000) / 10
}

function colorDiff(a: string | undefined, b: string | undefined): ColorDiff {
  return { from: a ?? null, to: b ?? null, distance: colorDistance(a, b) }
}

function numDelta(a: number | null | undefined, b: number | null | undefined): number | null {
  if (typeof a !== 'number' || typeof b !== 'number') return null
  return Math.round((b - a) * 1000) / 1000
}

export function compareLocalFeatures(a: LocalFeatures, b: LocalFeatures): FeatureComparison {
  const ca = a.colors ?? {}
  const cb = b.colors ?? {}
  const pa = a.composition ?? {}
  const pb = b.composition ?? {}
  return {
    dimensions: {
      widthDelta: numDelta(a.dimensions?.width, b.dimensions?.width),
      heightDelta: numDelta(a.dimensions?.height, b.dimensions?.height),
      aspectRatioDelta: numDelta(a.dimensions?.aspectRatio, b.dimensions?.aspectRatio),
    },
    colors: {
      dominant: colorDiff(ca.dominant, cb.dominant),
      accent: colorDiff(ca.accent, cb.accent),
      darkest: colorDiff(ca.darkest, cb.darkest),
      lightest: colorDiff(ca.lightest, cb.lightest),
    },
    stats: {
      whitespaceDelta: numDelta(pa.whitespaceRatio, pb.whitespaceRatio),
      saturationDelta: numDelta(pa.averageSaturation, pb.averageSaturation),
      lightnessDelta: numDelta(pa.averageLightness, pb.averageLightness),
      isDarkChanged:
        typeof pa.isDark === 'boolean' && typeof pb.isDark === 'boolean'
          ? pa.isDark !== pb.isDark
          : null,
    },
  }
}
