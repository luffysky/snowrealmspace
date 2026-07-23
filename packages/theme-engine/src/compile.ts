import {
  adjustLightness,
  contrastRatio,
  parseColor,
  pickReadableForeground,
  toHex,
  compositeOver,
} from './color.js'
import { analyzeTheme, flattenSurface } from './contrast.js'
import type { ThemeDefinition, ShadowPreset, MotionPreset } from './types.js'

/**
 * ThemeDefinition → CSS 變數。
 *
 * **純函式。** 這是刻意的：主題切換要在 150ms 內完成（v1.0 §42.1），
 * 唯一做得到的方式是直接寫 :root 的 style，不經過 React 渲染。
 * 純函式也讓這支能被完整單元測試 —— 視覺正確性的基礎不該靠人眼檢查。
 */

const SHADOWS: Record<ShadowPreset, { sm: string; md: string; lg: string }> = {
  none: { sm: 'none', md: 'none', lg: 'none' },
  soft: {
    sm: '0 1px 2px rgba(0,0,0,.03)',
    md: '0 2px 10px rgba(0,0,0,.05)',
    lg: '0 8px 24px rgba(0,0,0,.07)',
  },
  medium: {
    sm: '0 1px 2px rgba(0,0,0,.04)',
    md: '0 4px 16px rgba(0,0,0,.08)',
    lg: '0 12px 40px rgba(0,0,0,.12)',
  },
  dramatic: {
    sm: '0 2px 4px rgba(0,0,0,.08)',
    md: '0 8px 28px rgba(0,0,0,.16)',
    lg: '0 24px 64px rgba(0,0,0,.24)',
  },
}

const MOTION_SCALE: Record<MotionPreset, number> = {
  none: 0,
  soft: 0.75,
  float: 1,
  playful: 1.25,
  cinematic: 1.6,
}

/** 這些是功能性元素的最低對比，主題不合格時強制套用（ADR-011 §3.3）。 */
export type A11yFallback = {
  applied: boolean
  focusRing?: string
  danger?: string
}

export function computeA11yFallback(def: ThemeDefinition): A11yFallback {
  const report = analyzeTheme(def)
  if (report.passesAA) return { applied: false }

  const bg = def.colors.background
  const fallback: A11yFallback = { applied: true }

  // Focus indicator 必須 ≥ 3:1，否則鍵盤使用者會迷路
  if (contrastRatio(def.colors.focusRing, bg) < 3) {
    fallback.focusRing = pickReadableForeground(bg, '#ffffff', '#000000')
  }
  // 錯誤訊息必須讀得到
  if (contrastRatio(def.colors.danger, bg) < 4.5) {
    fallback.danger = pickReadableForeground(bg, '#ff6b6b', '#b3261e')
  }

  return fallback
}

/**
 * 產生 CSS 變數 map。
 * key 含 `--` 前綴，可直接寫進 element.style。
 */
export function compileThemeToCssVars(def: ThemeDefinition): Record<string, string> {
  const c = def.colors
  const s = def.surfaces
  const t = def.typography
  const m = def.motion

  const surfaceFlat = flattenSurface(c.surface, c.background)
  const surfaceAltFlat = flattenSurface(c.surfaceAlt, c.background)
  const shadows = SHADOWS[def.effects.shadow]
  const motionIntensity = MOTION_SCALE[m.preset] * clamp01(m.intensity)
  const fallback = computeA11yFallback(def)

  const vars: Record<string, string> = {
    // ── 顏色（直接映射）──────────────────────────────
    '--sr-primary': c.primary,
    '--sr-secondary': c.secondary,
    '--sr-accent': c.accent,
    '--sr-background': c.background,
    '--sr-surface': c.surface,
    '--sr-surface-alt': c.surfaceAlt,
    '--sr-text-primary': c.textPrimary,
    '--sr-text-secondary': c.textSecondary,
    '--sr-border': c.border,
    '--sr-success': c.success,
    '--sr-warning': c.warning,
    '--sr-danger': fallback.danger ?? c.danger,
    '--sr-focus-ring': fallback.focusRing ?? c.focusRing,

    // ── 衍生顏色（由引擎計算，非使用者設定）─────────────
    '--sr-primary-hover': adjustLightness(c.primary, -0.06),
    '--sr-primary-active': adjustLightness(c.primary, -0.12),
    '--sr-accent-hover': adjustLightness(c.accent, -0.06),
    '--sr-on-primary': pickReadableForeground(c.primary),
    '--sr-on-accent': pickReadableForeground(c.accent),
    // solid 材質需要不透明的卡片色 —— 由 surface 疊到 background 算出
    '--sr-surface-opaque': surfaceFlat,
    '--sr-surface-alt-opaque': surfaceAltFlat,
    '--sr-text-disabled': disabledText(c.textSecondary, c.background),
    '--sr-overlay-scrim': scrimFor(c.background),

    // ── 表面 ────────────────────────────────────────
    '--sr-radius': `${s.radius}px`,
    '--sr-radius-sm': `${Math.round(s.radius * 0.5)}px`,
    '--sr-radius-lg': `${Math.round(s.radius * 1.5)}px`,
    '--sr-blur': `${s.blur}px`,
    '--sr-surface-opacity': String(clamp01(s.opacity)),
    '--sr-border-width': `${s.borderWidth}px`,

    // ── 陰影 ────────────────────────────────────────
    '--sr-shadow-sm': shadows.sm,
    '--sr-shadow-md': shadows.md,
    '--sr-shadow-lg': shadows.lg,

    // ── 字體 ────────────────────────────────────────
    // 實際的 font-family 由 font-engine 依 fontId 解析後覆寫；
    // 這裡先放 id，讓套用流程不必等字體載入完成。
    '--sr-font-heading-id': t.headingFontId,
    '--sr-font-body-id': t.bodyFontId,
    '--sr-font-ui-id': t.uiFontId,

    '--sr-scale-heading': String(t.headingScale),
    '--sr-scale-body': String(t.bodyScale),
    '--sr-line-height': String(t.lineHeight),
    '--sr-letter-spacing': `${t.letterSpacing}em`,

    // ── 動態 ────────────────────────────────────────
    '--sr-motion-intensity': String(motionIntensity),
  }

  if (t.monoFontId) vars['--sr-font-mono-id'] = t.monoFontId

  return vars
}

/**
 * disabled 文字：比次要文字更淡，但仍必須維持 ≥ 3:1。
 * 直接乘 opacity 是常見錯誤 —— 那會讓 disabled 狀態在淺色主題下完全看不見。
 */
function disabledText(textSecondary: string, background: string): string {
  const fg = parseColor(textSecondary)
  const bg = parseColor(background)
  if (!fg || !bg) return textSecondary

  for (let alpha = 0.65; alpha >= 0.35; alpha -= 0.05) {
    const flat = toHex(compositeOver({ ...fg, a: alpha }, bg))
    if (contrastRatio(flat, background) >= 3) return flat
  }
  return textSecondary
}

/** 背景圖上文字的保護層。淺背景用深 scrim，反之亦然。 */
function scrimFor(background: string): string {
  const bg = parseColor(background)
  if (!bg) return 'rgba(0,0,0,.35)'
  const luminance = (bg.r * 299 + bg.g * 587 + bg.b * 114) / 1000
  return luminance > 128 ? 'rgba(0,0,0,.35)' : 'rgba(0,0,0,.55)'
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/** 產生可直接寫進 <style> 的 CSS 文字（SSR 首屏用）。 */
export function compileThemeToCssText(def: ThemeDefinition, selector = ':root'): string {
  const vars = compileThemeToCssVars(def)
  const body = Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n')
  return `${selector} {\n${body}\n}`
}

/** 套用主題時要一併設在 root 的 data 屬性（CSS 依此切換材質與動畫）。 */
export function themeDataAttributes(def: ThemeDefinition): Record<string, string> {
  return {
    'data-surface-style': def.surfaces.style,
    'data-motion-preset': def.motion.preset,
    'data-shadow': def.effects.shadow,
    'data-glow': String(def.effects.glow),
    'data-noise': String(def.effects.noise),
  }
}
