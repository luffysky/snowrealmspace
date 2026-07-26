import {
  parseColor,
  toHex,
  toRgbaString,
  rgbToHsl,
  hslToRgb,
  contrastRatio,
  relativeLuminance,
} from './color.js'
import type { ThemeDefinition } from './types.js'

/**
 * 深／淺色切換（選項 A）。
 *
 * 一套主題自動有「淺色版」與「深色版」，切換時保留使用者選的**強調色相與個性**，
 * 但底色與卡片一律走中性 —— 這樣淺色粉紅切到深色會得到「深灰底＋粉紅強調」的正常暗色，
 * 而不是「深粉紅底」（使用者明確不要那個）。反之亦然。
 *
 * `effectiveTheme(def, mode)` 是對外入口：不論使用者選的底是淺是深，都回傳該模式該有的樣子。
 * 純函式，前後端共用（SSR 首屏算、客戶端切換也算）。
 */

type Rgba = { r: number; g: number; b: number; a: number }

/** 保留色相，改設明度（0–1）與飽和縮放。 */
function withLightness(color: string, lightness: number, satScale = 1): string {
  const rgba = parseColor(color)
  if (!rgba) return color
  const hsl = rgbToHsl(rgba)
  const rgb = hslToRgb({ h: hsl.h, s: Math.min(1, hsl.s * satScale), l: lightness })
  return toHex(rgb)
}

/** rgba 版：保留 alpha（毛玻璃），改明度與飽和縮放。 */
function withLightnessAlpha(color: string, lightness: number, satScale = 1): string {
  const rgba = parseColor(color)
  if (!rgba) return color
  const hsl = rgbToHsl(rgba)
  const rgb = hslToRgb({ h: hsl.h, s: Math.min(1, hsl.s * satScale), l: lightness })
  return toRgbaString({ ...rgb, a: rgba.a } as Rgba)
}

/** 強調色在暗底上要夠亮才鮮明。太暗就提亮，但保留色相。 */
function vividOnDark(color: string, darkBg: string): string {
  const rgba = parseColor(color)
  if (!rgba) return color
  const hsl = rgbToHsl(rgba)
  let l = hsl.l
  if (l < 0.55) l = 0.6
  let out = toHex(hslToRgb({ h: hsl.h, s: hsl.s, l }))
  let guard = 0
  while (contrastRatio(out, darkBg) < 2.5 && l < 0.85 && guard++ < 6) {
    l += 0.06
    out = toHex(hslToRgb({ h: hsl.h, s: hsl.s, l }))
  }
  return out
}

/** 強調色在亮底上要夠深才鮮明。太亮就加深，但保留色相。 */
function vividOnLight(color: string, lightBg: string): string {
  const rgba = parseColor(color)
  if (!rgba) return color
  const hsl = rgbToHsl(rgba)
  let l = hsl.l
  if (l > 0.55) l = 0.5
  let out = toHex(hslToRgb({ h: hsl.h, s: hsl.s, l }))
  let guard = 0
  while (contrastRatio(out, lightBg) < 2.5 && l > 0.2 && guard++ < 6) {
    l -= 0.06
    out = toHex(hslToRgb({ h: hsl.h, s: hsl.s, l }))
  }
  return out
}

/** 主題的底是不是深色（用背景相對亮度判斷）。 */
export function isDarkTheme(def: ThemeDefinition): boolean {
  const p = parseColor(def.colors.background)
  return p ? relativeLuminance(p) < 0.4 : false
}

/**
 * 推導暗色版：中性深底＋深灰卡片（只留一絲主題色相），強調色提亮保色相。
 * 只改 colors，其餘（字體、材質、動態）不動。
 */
export function deriveDarkTheme(def: ThemeDefinition): ThemeDefinition {
  const c = def.colors

  const bgHsl = (() => {
    const p = parseColor(c.background)
    return p ? rgbToHsl(p) : { h: 0, s: 0, l: 1 }
  })()

  // 很暗、幾乎中性、只帶一絲主題色相的底（飽和上限 0.06，不再是深粉紅）
  const background = toHex(hslToRgb({ h: bgHsl.h, s: Math.min(bgHsl.s, 0.06), l: 0.11 }))

  const dark = {
    primary: vividOnDark(c.primary, background),
    secondary: vividOnDark(c.secondary, background),
    accent: vividOnDark(c.accent, background),
    background,
    // 卡片走中性深灰：把飽和壓到很低（satScale 0.18），只餘一點主題味，不是深彩色
    surface: withLightnessAlpha(c.surface, 0.17, 0.18),
    surfaceAlt: withLightnessAlpha(c.surfaceAlt, 0.21, 0.18),
    textPrimary: withLightness(c.textPrimary, 0.93, 0.4),
    textSecondary: withLightness(c.textSecondary, 0.68, 0.4),
    border: withLightnessAlpha(c.border, 0.42, 0.35),
    success: vividOnDark(c.success, background),
    warning: vividOnDark(c.warning, background),
    danger: vividOnDark(c.danger, background),
    focusRing: vividOnDark(c.focusRing, background),
  }

  return { ...def, colors: dark }
}

/**
 * 推導淺色版：中性亮底＋近白卡片（只留一絲主題色相），強調色加深保色相。
 * 給「使用者選了深色主題、但切到淺色模式」時用。
 */
export function deriveLightTheme(def: ThemeDefinition): ThemeDefinition {
  const c = def.colors

  const bgHsl = (() => {
    const p = parseColor(c.background)
    return p ? rgbToHsl(p) : { h: 0, s: 0, l: 0 }
  })()

  // 很亮、幾乎中性、只帶一絲主題色相的底
  const background = toHex(hslToRgb({ h: bgHsl.h, s: Math.min(bgHsl.s, 0.08), l: 0.98 }))

  const light = {
    primary: vividOnLight(c.primary, background),
    secondary: vividOnLight(c.secondary, background),
    accent: vividOnLight(c.accent, background),
    background,
    surface: withLightnessAlpha(c.surface, 0.99, 0.4),
    surfaceAlt: withLightnessAlpha(c.surfaceAlt, 0.95, 0.4),
    textPrimary: withLightness(c.textPrimary, 0.13, 0.6),
    textSecondary: withLightness(c.textSecondary, 0.38, 0.6),
    border: withLightnessAlpha(c.border, 0.85, 0.4),
    success: vividOnLight(c.success, background),
    warning: vividOnLight(c.warning, background),
    danger: vividOnLight(c.danger, background),
    focusRing: vividOnLight(c.focusRing, background),
  }

  return { ...def, colors: light }
}

/**
 * 回傳指定模式該有的主題，不論使用者選的底是淺是深：
 *   - 淺色模式：底是深的就推導淺色版，本來就淺的直接用
 *   - 深色模式：底是淺的就推導深色版，本來就深的直接用
 */
export function effectiveTheme(def: ThemeDefinition, mode: 'light' | 'dark'): ThemeDefinition {
  const baseDark = isDarkTheme(def)
  if (mode === 'dark') return baseDark ? def : deriveDarkTheme(def)
  return baseDark ? deriveLightTheme(def) : def
}
