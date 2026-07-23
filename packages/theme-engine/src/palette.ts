import {
  contrastRatio,
  ensureContrast,
  toHex,
  adjustLightness,
  rgbToHsl,
  pickReadableForeground,
  type Rgb,
} from './color.js'
import { analyzeTheme } from './contrast.js'
import { DEFAULT_THEME } from './presets.js'
import type { ThemeDefinition } from './types.js'

/**
 * 從圖片抽取配色。
 *
 * ADR-012：這條路徑**完全是本地演算法，不呼叫任何 AI**。
 * 產出屬於 Fact/Metric（可驗證、可重現、零成本），
 * 而非 Inference。這也是 p95 < 3 秒（v1.0 §42.1）唯一做得到的方式。
 *
 * 關鍵性質：**同一張圖每次結果必須完全相同。**
 * 因此 k-means 用固定種子與確定性初始化，不用 Math.random()。
 */

export type Palette = {
  dominant: string
  secondary: string
  accent: string
  darkest: string
  lightest: string
  /** 依叢集大小排序的完整色票 */
  swatches: { color: string; weight: number }[]
  /** 可驗證的統計數據 */
  stats: {
    colorCount: number
    averageSaturation: number
    averageLightness: number
    isDark: boolean
  }
}

// ── CIELAB：比 RGB 更符合人眼的距離感 ────────────────────

type Lab = { l: number; a: number; b: number }

function srgbToLinear(v: number): number {
  const s = v / 255
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

function rgbToLab({ r, g, b }: Rgb): Lab {
  const rl = srgbToLinear(r)
  const gl = srgbToLinear(g)
  const bl = srgbToLinear(b)

  // sRGB → XYZ（D65）
  const x = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) / 0.95047
  const y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175
  const z = (rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041) / 1.08883

  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const fx = f(x)
  const fy = f(y)
  const fz = f(z)

  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) }
}

function labDistanceSq(p: Lab, q: Lab): number {
  const dl = p.l - q.l
  const da = p.a - q.a
  const db = p.b - q.b
  return dl * dl + da * da + db * db
}

/**
 * k-means++ 的確定性版本。
 *
 * 標準 k-means++ 用隨機取樣選初始中心；這裡改成「每次都選距離現有中心
 * 最遠的那一點」。犧牲一點分群品質，換來完全可重現的結果 ——
 * 對使用者而言「同一張圖每次取出不同顏色」會顯得系統不穩定。
 */
function kMeans(points: Lab[], k: number, iterations = 12): { center: Lab; count: number }[] {
  if (points.length === 0) return []
  const realK = Math.min(k, points.length)

  const centers: Lab[] = [points[0]!]
  while (centers.length < realK) {
    let farthest = points[0]!
    let farthestDist = -1
    for (const p of points) {
      let nearest = Infinity
      for (const c of centers) nearest = Math.min(nearest, labDistanceSq(p, c))
      if (nearest > farthestDist) {
        farthestDist = nearest
        farthest = p
      }
    }
    centers.push(farthest)
  }

  const assignment = new Array<number>(points.length).fill(0)

  for (let iter = 0; iter < iterations; iter++) {
    let moved = false
    for (let i = 0; i < points.length; i++) {
      let best = 0
      let bestDist = Infinity
      for (let c = 0; c < centers.length; c++) {
        const d = labDistanceSq(points[i]!, centers[c]!)
        if (d < bestDist) {
          bestDist = d
          best = c
        }
      }
      if (assignment[i] !== best) {
        assignment[i] = best
        moved = true
      }
    }

    const sums = centers.map(() => ({ l: 0, a: 0, b: 0, n: 0 }))
    for (let i = 0; i < points.length; i++) {
      const s = sums[assignment[i]!]!
      s.l += points[i]!.l
      s.a += points[i]!.a
      s.b += points[i]!.b
      s.n++
    }
    for (let c = 0; c < centers.length; c++) {
      const s = sums[c]!
      if (s.n > 0) centers[c] = { l: s.l / s.n, a: s.a / s.n, b: s.b / s.n }
    }

    if (!moved) break
  }

  const counts = centers.map(() => 0)
  for (const a of assignment) counts[a]!++

  return centers
    .map((center, i) => ({ center, count: counts[i]! }))
    .filter((c) => c.count > 0)
    .sort((x, y) => y.count - x.count)
}

function labToRgb({ l, a, b }: Lab): Rgb {
  const fy = (l + 16) / 116
  const fx = fy + a / 500
  const fz = fy - b / 200
  const inv = (t: number) => (t > 0.206893 ? t * t * t : (t - 16 / 116) / 7.787)

  const x = inv(fx) * 0.95047
  const y = inv(fy)
  const z = inv(fz) * 1.08883

  const rl = x * 3.2404542 + y * -1.5371385 + z * -0.4985314
  const gl = x * -0.969266 + y * 1.8760108 + z * 0.041556
  const bl = x * 0.0556434 + y * -0.2040259 + z * 1.0572252

  const toSrgb = (v: number) => {
    const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055
    return Math.max(0, Math.min(255, c * 255))
  }
  return { r: toSrgb(rl), g: toSrgb(gl), b: toSrgb(bl) }
}

/**
 * 從像素資料抽取色票。
 *
 * @param pixels RGBA 平面陣列（每 4 個 byte 一個像素），通常來自 sharp 縮到 200×200
 * @param k 叢集數，預設 5
 */
export function extractPalette(pixels: Uint8Array | Uint8ClampedArray, k = 5): Palette {
  const points: Lab[] = []
  const rgbs: Rgb[] = []

  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const a = pixels[i + 3]!
    if (a < 128) continue // 幾乎透明的像素不參與取色
    const rgb = { r: pixels[i]!, g: pixels[i + 1]!, b: pixels[i + 2]! }
    rgbs.push(rgb)
    points.push(rgbToLab(rgb))
  }

  if (points.length === 0) {
    const fallback = DEFAULT_THEME.colors
    return {
      dominant: fallback.primary,
      secondary: fallback.secondary,
      accent: fallback.accent,
      darkest: fallback.textPrimary,
      lightest: fallback.background,
      swatches: [],
      stats: { colorCount: 0, averageSaturation: 0, averageLightness: 0, isDark: false },
    }
  }

  const clusters = kMeans(points, k)
  const swatches = clusters.map((c) => ({
    color: toHex(labToRgb(c.center)),
    weight: c.count / points.length,
  }))

  const byLightness = [...clusters].sort((x, y) => x.center.l - y.center.l)
  const darkest = toHex(labToRgb(byLightness[0]!.center))
  const lightest = toHex(labToRgb(byLightness[byLightness.length - 1]!.center))

  // 強調色：選彩度最高的叢集（a/b 的模長），而非單純第三大
  const mostChromatic = [...clusters].sort(
    (x, y) =>
      Math.hypot(y.center.a, y.center.b) - Math.hypot(x.center.a, x.center.b),
  )[0]!

  let satSum = 0
  let lightSum = 0
  for (const rgb of rgbs) {
    const hsl = rgbToHsl(rgb)
    satSum += hsl.s
    lightSum += hsl.l
  }

  const averageLightness = lightSum / rgbs.length

  return {
    dominant: swatches[0]?.color ?? DEFAULT_THEME.colors.primary,
    secondary: swatches[1]?.color ?? swatches[0]?.color ?? DEFAULT_THEME.colors.secondary,
    accent: toHex(labToRgb(mostChromatic.center)),
    darkest,
    lightest,
    swatches,
    stats: {
      colorCount: clusters.length,
      averageSaturation: Math.round((satSum / rgbs.length) * 1000) / 1000,
      averageLightness: Math.round(averageLightness * 1000) / 1000,
      isDark: averageLightness < 0.5,
    },
  }
}

/**
 * 從色票產生主題草稿（v1.0 §7.3）。
 *
 * 產出三個變體：明亮 / 柔和 / 深色。
 * **每個變體都保證 textPrimary 對 background ≥ 4.5:1** ——
 * 取色的結果不保證可讀，所以最後一定要跑一次 ensureContrast。
 */
export function buildThemesFromPalette(
  palette: Palette,
  baseName = '新主題',
): { definition: ThemeDefinition; variant: string }[] {
  const variants: { variant: string; build: () => ThemeDefinition }[] = [
    {
      variant: '明亮',
      build: () => buildVariant(palette, baseName, '明亮', '#ffffff', 0.96),
    },
    {
      variant: '柔和',
      build: () => buildVariant(palette, baseName, '柔和', palette.lightest, 0.9),
    },
    {
      variant: '深色',
      build: () => buildVariant(palette, baseName, '深色', palette.darkest, 0.16),
    },
  ]

  return variants.map((v) => ({ definition: v.build(), variant: v.variant }))
}

/**
 * 調整色塊自身的明度，直到黑或白其中之一能在它上面達到 target 對比。
 *
 * 為什麼需要：中間調的顏色（例如中灰、飽和的正紅）對黑與白的對比
 * 都在 3–4 之間，兩邊都不到 4.5。這時「選一個比較好的前景色」是無解的，
 * 必須動色塊本身。保留色相與飽和度，只推明度。
 */
function ensureBlockReadable(color: string, target = 4.5): string {
  if (contrastRatio(pickReadableForeground(color), color) >= target) return color

  const rgb = parseHexSafe(color)
  if (!rgb) return color
  const hsl = rgbToHsl(rgb)

  let best = color
  let bestRatio = contrastRatio(pickReadableForeground(color), color)

  // 兩個方向都試：變暗讓白字可讀，變亮讓黑字可讀。取先達標者。
  for (const dir of [-1, 1]) {
    for (let step = 1; step <= 100; step++) {
      const l = Math.max(0, Math.min(1, hsl.l + dir * step * 0.01))
      const candidate = toHex(hslToRgbLocal({ h: hsl.h, s: hsl.s, l }))
      const ratio = contrastRatio(pickReadableForeground(candidate), candidate)
      if (ratio > bestRatio) {
        best = candidate
        bestRatio = ratio
      }
      if (ratio >= target) return candidate
      if (l === 0 || l === 1) break
    }
  }
  return best
}

/** 讓某個顏色同時對兩個背景都達標（focus ring 要在背景與卡片上都看得見）。 */
function ensureContrastAgainstBoth(
  color: string,
  bgA: string,
  bgB: string,
  target: number,
): string {
  let result = ensureContrast(color, bgA, target)
  if (contrastRatio(result, bgB) >= target) return result

  result = ensureContrast(result, bgB, target)
  if (contrastRatio(result, bgA) >= target) return result

  // 兩邊互相拉扯而無解時，退到黑或白 —— 它們對任一背景的表現最極端
  for (const candidate of ['#000000', '#ffffff']) {
    if (contrastRatio(candidate, bgA) >= target && contrastRatio(candidate, bgB) >= target) {
      return candidate
    }
  }
  return result
}

function buildVariant(
  palette: Palette,
  baseName: string,
  variantName: string,
  backgroundSeed: string,
  targetLightness: number,
): ThemeDefinition {
  const isDark = targetLightness < 0.5

  // 背景：把種子色推到目標明度，保留其色相
  const background = pushToLightness(backgroundSeed, targetLightness)
  const textSeed = isDark ? '#f2f2f2' : '#241f22'

  const textPrimary = ensureContrast(textSeed, background, 4.5)
  const textSecondary = ensureContrast(
    adjustLightness(textPrimary, isDark ? -0.18 : 0.18),
    background,
    4.5,
  )

  const surfaceAlpha = isDark ? 0.08 : 0.62
  const surface = `rgba(255, 255, 255, ${surfaceAlpha})`
  const surfaceAlt = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.34)'
  const border = isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.12)'

  // 卡片壓平後的實際顏色 —— focus ring 必須在它上面也看得見
  const surfaceFlat = flattenSurfaceLocal(surface, background)

  // 主色與強調色是「會被當底色放文字」的色塊，必須自身可讀
  const primary = ensureBlockReadable(ensureContrast(palette.dominant, background, 3), 4.5)
  const accent = ensureBlockReadable(ensureContrast(palette.accent, background, 3), 4.5)
  const focusRing = ensureContrastAgainstBoth(accent, background, surfaceFlat, 3)

  const definition: ThemeDefinition = {
    schemaVersion: 1,
    name: `${baseName}・${variantName}`,
    colors: {
      primary,
      secondary: ensureContrast(palette.secondary, background, 1.2),
      accent,
      background,
      surface,
      surfaceAlt,
      textPrimary,
      textSecondary,
      border,
      success: ensureContrast(isDark ? '#6ee7a8' : '#2f7d5c', background, 4.5),
      warning: ensureContrast(isDark ? '#f0c674' : '#8a5a12', background, 4.5),
      danger: ensureContrast(isDark ? '#f28b96' : '#b03050', background, 4.5),
      focusRing,
    },
    typography: { ...DEFAULT_THEME.typography },
    surfaces: {
      style: 'glass',
      opacity: surfaceAlpha,
      blur: 20,
      radius: 24,
      borderWidth: 1,
    },
    effects: { shadow: isDark ? 'dramatic' : 'medium', glow: isDark, noise: false },
    motion: { preset: 'soft', intensity: 0.8, reduceMotionFallback: true },
  }

  // 最後檢查：若仍有不合格項，把文字再推一次
  const report = analyzeTheme(definition)
  if (!report.passesAA) {
    definition.colors.textPrimary = ensureContrast(
      definition.colors.textPrimary,
      definition.colors.background,
      7,
    )
  }

  return definition
}

function pushToLightness(color: string, targetL: number): string {
  const rgba = { ...(parseHexSafe(color) ?? { r: 255, g: 255, b: 255 }) }
  const hsl = rgbToHsl(rgba)
  // 保留色相，降低飽和度（背景不該太搶眼）
  const s = Math.min(hsl.s, targetL > 0.5 ? 0.22 : 0.3)
  return toHex(hslToRgbLocal({ h: hsl.h, s, l: targetL }))
}

function parseHexSafe(color: string): Rgb | null {
  const m = /^#([0-9a-f]{6})$/i.exec(color.trim())
  if (!m?.[1]) return null
  const hex = m[1]
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  }
}

function hslToRgbLocal({ h, s, l }: { h: number; s: number; l: number }): Rgb {
  const hn = (((h % 360) + 360) % 360) / 360
  if (s === 0) {
    const v = l * 255
    return { r: v, g: v, b: v }
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const ch = (t: number) => {
    let tt = t
    if (tt < 0) tt += 1
    if (tt > 1) tt -= 1
    if (tt < 1 / 6) return p + (q - p) * 6 * tt
    if (tt < 1 / 2) return q
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
    return p
  }
  return { r: ch(hn + 1 / 3) * 255, g: ch(hn) * 255, b: ch(hn - 1 / 3) * 255 }
}

/** 供測試與外部使用：確認兩個色票是否相同（浮點誤差容忍）。 */
export function palettesEqual(a: Palette, b: Palette): boolean {
  if (a.swatches.length !== b.swatches.length) return false
  return a.swatches.every((s, i) => s.color === b.swatches[i]?.color)
}

void contrastRatio

/** 本地版的 surface 壓平（避免與 contrast.ts 互相 import 造成循環）。 */
function flattenSurfaceLocal(surface: string, background: string): string {
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(surface.trim())
  if (!m) return surface
  const alpha = m[4] === undefined ? 1 : parseFloat(m[4])
  if (alpha >= 1) return surface
  const bg = parseHexSafe(background)
  if (!bg) return surface
  const fg = { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) }
  return toHex({
    r: fg.r * alpha + bg.r * (1 - alpha),
    g: fg.g * alpha + bg.g * (1 - alpha),
    b: fg.b * alpha + bg.b * (1 - alpha),
  })
}
