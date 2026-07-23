import { parseColor, toHex, toRgbaString, rgbToHsl, hslToRgb, contrastRatio } from './color.js'
import type { ThemeDefinition } from './types.js'

/**
 * 從一個（淺色）主題推導出暗色版。實作深淺色切換（選項 A）。
 *
 * 不是把主題整個換掉 —— 而是**保留使用者選的色相與個性**，只把明暗翻轉：
 *   背景 → 暗、文字 → 亮、強調色 → 提亮到在暗底上仍鮮明。
 * 這樣使用者的每一套自訂主題都自動有對應的暗色版，切換時個性不變。
 *
 * 純函式，前後端共用（SSR 首屏用它算暗色，客戶端切換也用它）。
 */

type Rgba = { r: number; g: number; b: number; a: number }

/** 保留色相與飽和，改設明度（0–1）。 */
function withLightness(color: string, lightness: number, satScale = 1): string {
  const rgba = parseColor(color)
  if (!rgba) return color
  const hsl = rgbToHsl(rgba)
  const rgb = hslToRgb({ h: hsl.h, s: Math.min(1, hsl.s * satScale), l: lightness })
  return toHex(rgb)
}

/** rgba 版：保留 alpha，改明度。 */
function withLightnessAlpha(color: string, lightness: number, satScale = 1): string {
  const rgba = parseColor(color)
  if (!rgba) return color
  const hsl = rgbToHsl(rgba)
  const rgb = hslToRgb({ h: hsl.h, s: Math.min(1, hsl.s * satScale), l: lightness })
  return toRgbaString({ ...rgb, a: rgba.a } as Rgba)
}

/**
 * 強調色在暗底上要夠亮才鮮明。太暗就提亮，但保留色相。
 * 目標：對暗背景至少有一定對比，且明度不低於 0.55。
 */
function vividOnDark(color: string, darkBg: string): string {
  const rgba = parseColor(color)
  if (!rgba) return color
  const hsl = rgbToHsl(rgba)
  let l = hsl.l
  if (l < 0.55) l = 0.6
  let out = toHex(hslToRgb({ h: hsl.h, s: hsl.s, l }))
  // 還是太貼近背景就再提亮一點
  let guard = 0
  while (contrastRatio(out, darkBg) < 2.5 && l < 0.85 && guard++ < 6) {
    l += 0.06
    out = toHex(hslToRgb({ h: hsl.h, s: hsl.s, l }))
  }
  return out
}

/**
 * 推導暗色版。只改 colors，其餘（字體、材質、動態）不動。
 */
export function deriveDarkTheme(def: ThemeDefinition): ThemeDefinition {
  const c = def.colors

  // 用背景的色相當整體底色的色調，讓暗色版仍帶主題的味道
  const bgHsl = (() => {
    const p = parseColor(c.background)
    return p ? rgbToHsl(p) : { h: 0, s: 0, l: 1 }
  })()

  // 以主題色相做一個很暗、微帶色調的底
  const background = toHex(hslToRgb({ h: bgHsl.h, s: Math.min(bgHsl.s, 0.16), l: 0.11 }))

  const dark = {
    primary: vividOnDark(c.primary, background),
    secondary: vividOnDark(c.secondary, background),
    accent: vividOnDark(c.accent, background),
    background,
    // surface 比背景亮一階，保留原本的透明度（毛玻璃）
    surface: withLightnessAlpha(c.surface, 0.17, 0.9),
    surfaceAlt: withLightnessAlpha(c.surfaceAlt, 0.21, 0.9),
    textPrimary: withLightness(c.textPrimary, 0.93, 0.5),
    textSecondary: withLightness(c.textSecondary, 0.68, 0.5),
    border: withLightnessAlpha(c.border, 0.42, 0.6),
    // 語意色也要在暗底上看得清
    success: vividOnDark(c.success, background),
    warning: vividOnDark(c.warning, background),
    danger: vividOnDark(c.danger, background),
    focusRing: vividOnDark(c.focusRing, background),
  }

  return { ...def, colors: dark }
}
