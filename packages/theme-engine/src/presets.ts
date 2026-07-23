import type { ThemeDefinition } from './types.js'

/**
 * 內建主題。
 *
 * 每一套都已通過 analyzeTheme 的 AA 檢查 —— 有測試守著。
 * 使用者第一次進來看到的東西不該有無障礙問題。
 */

const baseTypography = {
  headingFontId: 'noto-serif-tc',
  bodyFontId: 'noto-sans-tc',
  uiFontId: 'inter',
  monoFontId: 'jetbrains-mono',
  headingScale: 1,
  bodyScale: 1,
  lineHeight: 1.7,
  letterSpacing: 0,
}

export const PRESET_THEMES: ThemeDefinition[] = [
  {
    schemaVersion: 1,
    name: '粉霧',
    colors: {
      primary: '#d4739a',
      secondary: '#ffdce8',
      accent: '#8c5870',
      background: '#fff7fb',
      surface: 'rgba(255, 255, 255, 0.58)',
      surfaceAlt: 'rgba(255, 255, 255, 0.32)',
      textPrimary: '#38252d',
      textSecondary: '#6b4a58',
      border: 'rgba(140, 88, 112, 0.18)',
      success: '#2f7d5c',
      warning: '#8a5a12',
      danger: '#b03050',
      focusRing: '#6b3d52',
    },
    typography: { ...baseTypography },
    surfaces: { style: 'glass', opacity: 0.58, blur: 20, radius: 24, borderWidth: 1 },
    effects: { shadow: 'medium', glow: false, noise: false },
    motion: { preset: 'soft', intensity: 0.8, reduceMotionFallback: true },
  },
  {
    schemaVersion: 1,
    name: '夜',
    colors: {
      primary: '#8fb8e8',
      secondary: '#2a3550',
      accent: '#a9c8f0',
      background: '#14171f',
      surface: 'rgba(255, 255, 255, 0.07)',
      surfaceAlt: 'rgba(255, 255, 255, 0.04)',
      textPrimary: '#eef1f6',
      textSecondary: '#a8b2c4',
      border: 'rgba(255, 255, 255, 0.14)',
      success: '#6ee7a8',
      warning: '#f0c674',
      danger: '#f28b96',
      focusRing: '#a9c8f0',
    },
    typography: { ...baseTypography },
    surfaces: { style: 'glass', opacity: 0.07, blur: 24, radius: 20, borderWidth: 1 },
    effects: { shadow: 'dramatic', glow: true, noise: false },
    motion: { preset: 'float', intensity: 0.7, reduceMotionFallback: true },
  },
  {
    schemaVersion: 1,
    name: '紙',
    colors: {
      primary: '#4a4a48',
      secondary: '#e8e4dc',
      accent: '#6b5b47',
      background: '#faf8f4',
      surface: '#ffffff',
      surfaceAlt: '#f4f1ea',
      textPrimary: '#26241f',
      textSecondary: '#5c584e',
      border: 'rgba(38, 36, 31, 0.14)',
      success: '#2f6d4a',
      warning: '#8a5a12',
      danger: '#a83232',
      focusRing: '#26241f',
    },
    typography: { ...baseTypography, lineHeight: 1.8 },
    surfaces: { style: 'soft', opacity: 1, blur: 0, radius: 8, borderWidth: 0 },
    effects: { shadow: 'soft', glow: false, noise: false },
    motion: { preset: 'none', intensity: 0, reduceMotionFallback: true },
  },
  {
    schemaVersion: 1,
    name: '清晨',
    colors: {
      primary: '#4b8fa8',
      secondary: '#d6ecf2',
      accent: '#2f6b80',
      background: '#f5fbfd',
      surface: 'rgba(255, 255, 255, 0.7)',
      surfaceAlt: 'rgba(255, 255, 255, 0.45)',
      textPrimary: '#1f3038',
      textSecondary: '#4a5c66',
      border: 'rgba(47, 107, 128, 0.18)',
      success: '#2f7d5c',
      warning: '#8a5a12',
      danger: '#b03050',
      focusRing: '#2f6b80',
    },
    typography: { ...baseTypography },
    surfaces: { style: 'glass', opacity: 0.7, blur: 16, radius: 28, borderWidth: 1 },
    effects: { shadow: 'soft', glow: false, noise: false },
    motion: { preset: 'soft', intensity: 0.6, reduceMotionFallback: true },
  },
]

export const DEFAULT_THEME: ThemeDefinition = PRESET_THEMES[0]!

/** 使用者按下「還原預設」時用的。 */
export function defaultThemeDefinition(): ThemeDefinition {
  return structuredClone(DEFAULT_THEME)
}

/**
 * 中性黑白。
 *
 * 用於「必須有字面色值」的少數場合：
 *   - <input type="color"> 的 fallback（該元素不接受非法值）
 *   - 演算法的邊界值（取色失敗時的保底）
 *
 * 集中在這裡而非散落各處，是為了讓 --sr-* token 規則保持有意義 ——
 * 有例外是正常的，例外沒有名字才是問題。
 */
export const NEUTRAL = {
  black: '#000000',
  white: '#ffffff',
  nearBlack: '#1a1a1a',
} as const
