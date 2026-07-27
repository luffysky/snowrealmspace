import type { ThemeDefinition } from './types.js'
import { hslToRgb, toHex, relativeLuminance } from './color.js'

/**
 * 內建主題。
 *
 * 每一套都已通過 analyzeTheme 的 AA 檢查 —— 有測試守著。
 * 使用者第一次進來看到的東西不該有無障礙問題。
 *
 * 分兩部分：
 *  - CURATED_THEMES：手工調的招牌主題（粉霧/夜/森…）。
 *  - 程式生成（generateHueThemes）：固定「AA 安全亮度」、只旋轉色相，
 *    因此每一套都保證過 AA（對比看亮度，不看色相）。用來把數量鋪到上百套、依色系分類。
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

const CURATED_THEMES: ThemeDefinition[] = [
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
  {
    schemaVersion: 1,
    name: '森',
    colors: {
      primary: '#2f7d54',
      secondary: '#dcecdf',
      accent: '#1f5c3d',
      background: '#f4faf5',
      surface: 'rgba(255, 255, 255, 0.7)',
      surfaceAlt: 'rgba(255, 255, 255, 0.44)',
      textPrimary: '#1c2b22',
      textSecondary: '#48584e',
      border: 'rgba(31, 92, 61, 0.18)',
      success: '#2f7d5c',
      warning: '#8a5a12',
      danger: '#b03050',
      focusRing: '#1f5c3d',
    },
    typography: { ...baseTypography },
    surfaces: { style: 'glass', opacity: 0.7, blur: 18, radius: 22, borderWidth: 1 },
    effects: { shadow: 'soft', glow: false, noise: false },
    motion: { preset: 'soft', intensity: 0.6, reduceMotionFallback: true },
  },
  {
    schemaVersion: 1,
    name: '暮',
    colors: {
      primary: '#e08a5a',
      secondary: '#3a2c3f',
      accent: '#f0a878',
      background: '#1c1622',
      surface: 'rgba(255, 255, 255, 0.07)',
      surfaceAlt: 'rgba(255, 255, 255, 0.04)',
      textPrimary: '#f4ebe6',
      textSecondary: '#c0aeb8',
      border: 'rgba(255, 255, 255, 0.14)',
      success: '#6ee7a8',
      warning: '#f0c674',
      danger: '#f28b96',
      focusRing: '#f0a878',
    },
    typography: { ...baseTypography },
    surfaces: { style: 'glass', opacity: 0.07, blur: 22, radius: 20, borderWidth: 1 },
    effects: { shadow: 'dramatic', glow: true, noise: false },
    motion: { preset: 'float', intensity: 0.7, reduceMotionFallback: true },
  },
  {
    schemaVersion: 1,
    name: '海',
    colors: {
      primary: '#1f7a8c',
      secondary: '#d2ecf0',
      accent: '#125866',
      background: '#f2fafb',
      surface: 'rgba(255, 255, 255, 0.68)',
      surfaceAlt: 'rgba(255, 255, 255, 0.4)',
      textPrimary: '#163034',
      textSecondary: '#42585c',
      border: 'rgba(18, 88, 102, 0.18)',
      success: '#2f7d5c',
      warning: '#8a5a12',
      danger: '#b03050',
      focusRing: '#125866',
    },
    typography: { ...baseTypography },
    surfaces: { style: 'glass', opacity: 0.68, blur: 18, radius: 26, borderWidth: 1 },
    effects: { shadow: 'soft', glow: false, noise: false },
    motion: { preset: 'soft', intensity: 0.6, reduceMotionFallback: true },
  },
  {
    schemaVersion: 1,
    name: '墨',
    colors: {
      primary: '#3a3a3a',
      secondary: '#2a2a2a',
      accent: '#8a8a8a',
      background: '#131313',
      surface: 'rgba(255, 255, 255, 0.06)',
      surfaceAlt: 'rgba(255, 255, 255, 0.03)',
      textPrimary: '#ececec',
      textSecondary: '#a6a6a6',
      border: 'rgba(255, 255, 255, 0.16)',
      success: '#6ee7a8',
      warning: '#f0c674',
      danger: '#f28b96',
      focusRing: '#cfcfcf',
    },
    typography: { ...baseTypography },
    surfaces: { style: 'outline', opacity: 0.06, blur: 0, radius: 6, borderWidth: 1 },
    effects: { shadow: 'soft', glow: false, noise: false },
    motion: { preset: 'none', intensity: 0, reduceMotionFallback: true },
  },
  {
    schemaVersion: 1,
    name: '蜜',
    colors: {
      primary: '#b8791f',
      secondary: '#f5e6c8',
      accent: '#8a5a12',
      background: '#fdf8ef',
      surface: 'rgba(255, 255, 255, 0.62)',
      surfaceAlt: 'rgba(255, 255, 255, 0.36)',
      textPrimary: '#3a2c16',
      textSecondary: '#5f4c30',
      border: 'rgba(138, 90, 18, 0.2)',
      success: '#2f7d5c',
      warning: '#8a5a12',
      danger: '#b03050',
      focusRing: '#8a5a12',
    },
    typography: { ...baseTypography },
    surfaces: { style: 'soft', opacity: 0.62, blur: 12, radius: 18, borderWidth: 1 },
    effects: { shadow: 'soft', glow: false, noise: false },
    motion: { preset: 'soft', intensity: 0.5, reduceMotionFallback: true },
  },
  {
    schemaVersion: 1,
    name: '薰衣草',
    colors: {
      primary: '#7c5cc4',
      secondary: '#e6ddf5',
      accent: '#5a3d9c',
      background: '#f8f5fd',
      surface: 'rgba(255, 255, 255, 0.66)',
      surfaceAlt: 'rgba(255, 255, 255, 0.4)',
      textPrimary: '#2a2338',
      textSecondary: '#544a68',
      border: 'rgba(90, 61, 156, 0.18)',
      success: '#2f7d5c',
      warning: '#8a5a12',
      danger: '#b03050',
      focusRing: '#5a3d9c',
    },
    typography: { ...baseTypography },
    surfaces: { style: 'glass', opacity: 0.66, blur: 20, radius: 24, borderWidth: 1 },
    effects: { shadow: 'medium', glow: false, noise: false },
    motion: { preset: 'soft', intensity: 0.7, reduceMotionFallback: true },
  },
  {
    schemaVersion: 1,
    name: '珊瑚',
    colors: {
      primary: '#e06a5a',
      secondary: '#fbdcd4',
      accent: '#b8443a',
      background: '#fff6f3',
      surface: 'rgba(255, 255, 255, 0.6)',
      surfaceAlt: 'rgba(255, 255, 255, 0.34)',
      textPrimary: '#3a221e',
      textSecondary: '#66443e',
      border: 'rgba(184, 68, 58, 0.18)',
      success: '#2f7d5c',
      warning: '#8a5a12',
      danger: '#b03050',
      focusRing: '#b8443a',
    },
    typography: { ...baseTypography },
    surfaces: { style: 'glass', opacity: 0.6, blur: 16, radius: 22, borderWidth: 1 },
    effects: { shadow: 'medium', glow: false, noise: false },
    motion: { preset: 'soft', intensity: 0.7, reduceMotionFallback: true },
  },

  // ── 追加批次（0727）：淺色底＝深字、深色底＝淺字，皆過 AA（compile.test 守著）──
  {
    schemaVersion: 1,
    name: '櫻',
    colors: {
      primary: '#d16a8f',
      secondary: '#fbe0ec',
      accent: '#a84d70',
      background: '#fff6fa',
      surface: 'rgba(255, 255, 255, 0.62)',
      surfaceAlt: 'rgba(255, 255, 255, 0.36)',
      textPrimary: '#3a2530',
      textSecondary: '#6b4a58',
      border: 'rgba(168, 77, 112, 0.18)',
      success: '#2f7d5c',
      warning: '#8a5a12',
      danger: '#b03050',
      focusRing: '#a84d70',
    },
    typography: { ...baseTypography },
    surfaces: { style: 'glass', opacity: 0.62, blur: 18, radius: 24, borderWidth: 1 },
    effects: { shadow: 'medium', glow: false, noise: false },
    motion: { preset: 'soft', intensity: 0.7, reduceMotionFallback: true },
  },
  {
    schemaVersion: 1,
    name: '薄荷',
    colors: {
      primary: '#2f9d8a',
      secondary: '#d6f0ea',
      accent: '#1f7a6a',
      background: '#f2fbf9',
      surface: 'rgba(255, 255, 255, 0.68)',
      surfaceAlt: 'rgba(255, 255, 255, 0.4)',
      textPrimary: '#163330',
      textSecondary: '#42605a',
      border: 'rgba(31, 122, 106, 0.18)',
      success: '#2f7d5c',
      warning: '#8a5a12',
      danger: '#b03050',
      focusRing: '#1f7a6a',
    },
    typography: { ...baseTypography },
    surfaces: { style: 'glass', opacity: 0.68, blur: 18, radius: 24, borderWidth: 1 },
    effects: { shadow: 'soft', glow: false, noise: false },
    motion: { preset: 'soft', intensity: 0.6, reduceMotionFallback: true },
  },
  {
    schemaVersion: 1,
    name: '奶油',
    colors: {
      primary: '#c79a2a',
      secondary: '#f7edcf',
      accent: '#6e5410',
      background: '#fdfaf0',
      surface: 'rgba(255, 255, 255, 0.62)',
      surfaceAlt: 'rgba(255, 255, 255, 0.36)',
      textPrimary: '#362e18',
      textSecondary: '#5f5330',
      border: 'rgba(110, 84, 16, 0.2)',
      success: '#2f7d5c',
      warning: '#8a5a12',
      danger: '#b03050',
      focusRing: '#6e5410',
    },
    typography: { ...baseTypography },
    surfaces: { style: 'soft', opacity: 0.62, blur: 12, radius: 18, borderWidth: 1 },
    effects: { shadow: 'soft', glow: false, noise: false },
    motion: { preset: 'soft', intensity: 0.5, reduceMotionFallback: true },
  },
  {
    schemaVersion: 1,
    name: '楓',
    colors: {
      primary: '#e0704a',
      secondary: '#fadfd6',
      accent: '#9a3a28',
      background: '#fff5f2',
      surface: 'rgba(255, 255, 255, 0.6)',
      surfaceAlt: 'rgba(255, 255, 255, 0.34)',
      textPrimary: '#3a221e',
      textSecondary: '#66443e',
      border: 'rgba(154, 58, 40, 0.18)',
      success: '#2f7d5c',
      warning: '#8a5a12',
      danger: '#b03050',
      focusRing: '#9a3a28',
    },
    typography: { ...baseTypography },
    surfaces: { style: 'glass', opacity: 0.6, blur: 16, radius: 20, borderWidth: 1 },
    effects: { shadow: 'medium', glow: false, noise: false },
    motion: { preset: 'soft', intensity: 0.6, reduceMotionFallback: true },
  },
  {
    schemaVersion: 1,
    name: '霧',
    colors: {
      primary: '#5c7189',
      secondary: '#e2e8ef',
      accent: '#3f5266',
      background: '#f6f8fb',
      surface: 'rgba(255, 255, 255, 0.66)',
      surfaceAlt: 'rgba(255, 255, 255, 0.4)',
      textPrimary: '#232a33',
      textSecondary: '#4e5763',
      border: 'rgba(63, 82, 102, 0.18)',
      success: '#2f7d5c',
      warning: '#8a5a12',
      danger: '#b03050',
      focusRing: '#3f5266',
    },
    typography: { ...baseTypography },
    surfaces: { style: 'glass', opacity: 0.66, blur: 18, radius: 22, borderWidth: 1 },
    effects: { shadow: 'soft', glow: false, noise: false },
    motion: { preset: 'soft', intensity: 0.5, reduceMotionFallback: true },
  },
  {
    schemaVersion: 1,
    name: '石',
    colors: {
      primary: '#6b7078',
      secondary: '#e6e8eb',
      accent: '#4a4f57',
      background: '#f6f7f8',
      surface: 'rgba(255, 255, 255, 0.64)',
      surfaceAlt: 'rgba(255, 255, 255, 0.38)',
      textPrimary: '#26282c',
      textSecondary: '#55585e',
      border: 'rgba(74, 79, 87, 0.18)',
      success: '#2f7d5c',
      warning: '#8a5a12',
      danger: '#b03050',
      focusRing: '#4a4f57',
    },
    typography: { ...baseTypography },
    surfaces: { style: 'soft', opacity: 0.64, blur: 10, radius: 12, borderWidth: 0 },
    effects: { shadow: 'soft', glow: false, noise: false },
    motion: { preset: 'none', intensity: 0, reduceMotionFallback: true },
  },
  {
    schemaVersion: 1,
    name: '靛',
    colors: {
      primary: '#8f9ee8',
      secondary: '#2a3050',
      accent: '#a9b4f0',
      background: '#14161f',
      surface: 'rgba(255, 255, 255, 0.07)',
      surfaceAlt: 'rgba(255, 255, 255, 0.04)',
      textPrimary: '#eef0f6',
      textSecondary: '#a8afc4',
      border: 'rgba(255, 255, 255, 0.14)',
      success: '#6ee7a8',
      warning: '#f0c674',
      danger: '#f28b96',
      focusRing: '#a9b4f0',
    },
    typography: { ...baseTypography },
    surfaces: { style: 'glass', opacity: 0.07, blur: 24, radius: 20, borderWidth: 1 },
    effects: { shadow: 'dramatic', glow: true, noise: false },
    motion: { preset: 'float', intensity: 0.7, reduceMotionFallback: true },
  },
  {
    schemaVersion: 1,
    name: '松',
    colors: {
      primary: '#5fb488',
      secondary: '#22332a',
      accent: '#7fd0a4',
      background: '#121a15',
      surface: 'rgba(255, 255, 255, 0.07)',
      surfaceAlt: 'rgba(255, 255, 255, 0.04)',
      textPrimary: '#e9f2ec',
      textSecondary: '#a6bbae',
      border: 'rgba(255, 255, 255, 0.14)',
      success: '#6ee7a8',
      warning: '#f0c674',
      danger: '#f28b96',
      focusRing: '#7fd0a4',
    },
    typography: { ...baseTypography },
    surfaces: { style: 'glass', opacity: 0.07, blur: 22, radius: 20, borderWidth: 1 },
    effects: { shadow: 'dramatic', glow: true, noise: false },
    motion: { preset: 'float', intensity: 0.6, reduceMotionFallback: true },
  },
  {
    schemaVersion: 1,
    name: '酒紅',
    colors: {
      primary: '#d98a9a',
      secondary: '#3a2830',
      accent: '#f0a9b6',
      background: '#1c1319',
      surface: 'rgba(255, 255, 255, 0.07)',
      surfaceAlt: 'rgba(255, 255, 255, 0.04)',
      textPrimary: '#f4e6ea',
      textSecondary: '#c0aeb4',
      border: 'rgba(255, 255, 255, 0.14)',
      success: '#6ee7a8',
      warning: '#f0c674',
      danger: '#f28b96',
      focusRing: '#f0a9b6',
    },
    typography: { ...baseTypography },
    surfaces: { style: 'glass', opacity: 0.07, blur: 22, radius: 20, borderWidth: 1 },
    effects: { shadow: 'dramatic', glow: true, noise: false },
    motion: { preset: 'float', intensity: 0.7, reduceMotionFallback: true },
  },
  {
    schemaVersion: 1,
    name: '炭',
    colors: {
      primary: '#c9b99f',
      secondary: '#2a2620',
      accent: '#a89578',
      background: '#17140f',
      surface: 'rgba(255, 255, 255, 0.06)',
      surfaceAlt: 'rgba(255, 255, 255, 0.03)',
      textPrimary: '#efe9df',
      textSecondary: '#b8ad9c',
      border: 'rgba(255, 255, 255, 0.14)',
      success: '#6ee7a8',
      warning: '#f0c674',
      danger: '#f28b96',
      focusRing: '#d4c8b2',
    },
    typography: { ...baseTypography },
    surfaces: { style: 'outline', opacity: 0.06, blur: 0, radius: 8, borderWidth: 1 },
    effects: { shadow: 'soft', glow: false, noise: false },
    motion: { preset: 'none', intensity: 0, reduceMotionFallback: true },
  },
]

/** 招牌主題的分類。 */
const CURATED_CATEGORY: Record<string, string> = {
  粉霧: '淺色柔和',
  櫻: '淺色柔和',
  奶油: '淺色柔和',
  蜜: '淺色柔和',
  珊瑚: '淺色柔和',
  薰衣草: '淺色柔和',
  清晨: '淺色自然',
  森: '淺色自然',
  海: '淺色自然',
  薄荷: '淺色自然',
  楓: '淺色自然',
  紙: '淺色中性',
  霧: '淺色中性',
  石: '淺色中性',
  夜: '深色',
  暮: '深色',
  靛: '深色',
  松: '深色',
  酒紅: '深色',
  墨: '深色中性',
  炭: '深色中性',
}

// ── 程式生成的色系主題（AA 保證）──────────────────────────────
// s、l 以 0–100 傳入，hslToRgb 需要 0–1。
const hx = (h: number, s: number, l: number): string => toHex(hslToRgb({ h, s: s / 100, l: l / 100 }))
const lumOf = (h: number, s: number, l: number): number =>
  relativeLuminance(hslToRgb({ h, s: s / 100, l: l / 100 }))

/** 降低亮度直到「白字在其上對比 ≥ 4.5」（亮度 ≤ ~0.175）。 */
function darkForWhite(h: number, s: number): string {
  for (let l = 46; l >= 18; l -= 2) if (lumOf(h, s, l) <= 0.175) return hx(h, s, l)
  return hx(h, s, 18)
}
/** 提高亮度直到「深字(#1a1a1a)在其上對比 ≥ 4.5」（亮度 ≥ ~0.34）。 */
function lightForDark(h: number, s: number): string {
  for (let l = 60; l <= 90; l += 2) if (lumOf(h, s, l) >= 0.34) return hx(h, s, l)
  return hx(h, s, 90)
}

function makeLight(name: string, h: number, s: number): ThemeDefinition {
  return {
    schemaVersion: 1,
    name,
    colors: {
      primary: darkForWhite(h, s),
      secondary: hx(h, Math.min(58, s), 90),
      accent: darkForWhite(h, Math.min(72, s + 8)),
      background: hx(h, Math.max(26, s - 12), 98),
      surface: 'rgba(255, 255, 255, 0.64)',
      surfaceAlt: 'rgba(255, 255, 255, 0.38)',
      textPrimary: hx(h, 22, 15),
      textSecondary: hx(h, 15, 35),
      border: 'rgba(20, 20, 20, 0.14)',
      success: '#2f7d5c',
      warning: '#8a5a12',
      danger: '#b03050',
      focusRing: darkForWhite(h, Math.min(72, s + 8)),
    },
    typography: { ...baseTypography },
    surfaces: { style: 'glass', opacity: 0.64, blur: 18, radius: 22, borderWidth: 1 },
    effects: { shadow: 'soft', glow: false, noise: false },
    motion: { preset: 'soft', intensity: 0.6, reduceMotionFallback: true },
  }
}

function makeDark(name: string, h: number, s: number): ThemeDefinition {
  return {
    schemaVersion: 1,
    name,
    colors: {
      primary: lightForDark(h, s),
      secondary: hx(h, 30, 22),
      accent: lightForDark(h, Math.min(70, s + 8)),
      background: hx(h, 28, 10),
      surface: 'rgba(255, 255, 255, 0.07)',
      surfaceAlt: 'rgba(255, 255, 255, 0.04)',
      textPrimary: hx(h, 14, 93),
      textSecondary: hx(h, 12, 70),
      border: 'rgba(255, 255, 255, 0.14)',
      success: '#6ee7a8',
      warning: '#f0c674',
      danger: '#f28b96',
      focusRing: lightForDark(h, Math.min(70, s + 8)),
    },
    typography: { ...baseTypography },
    surfaces: { style: 'glass', opacity: 0.07, blur: 22, radius: 20, borderWidth: 1 },
    effects: { shadow: 'dramatic', glow: true, noise: false },
    motion: { preset: 'float', intensity: 0.6, reduceMotionFallback: true },
  }
}

// 12 個色系 × {淺,深} × {鮮,柔}，名稱依中文色名，分類依色調。
const HUE_FAMILIES: { h: number; name: string }[] = [
  { h: 2, name: '赤' },
  { h: 20, name: '朱' },
  { h: 36, name: '琥珀' },
  { h: 52, name: '金' },
  { h: 82, name: '柳' },
  { h: 135, name: '翠' },
  { h: 162, name: '碧' },
  { h: 190, name: '青' },
  { h: 212, name: '湛' },
  { h: 250, name: '靛' },
  { h: 282, name: '紫' },
  { h: 320, name: '桃' },
]

const generated: { def: ThemeDefinition; category: string }[] = []
for (const f of HUE_FAMILIES) {
  generated.push({ def: makeLight(`${f.name}·淺`, f.h, 62), category: '鮮彩・淺' })
  generated.push({ def: makeLight(`${f.name}·淺柔`, f.h, 34), category: '柔彩・淺' })
  generated.push({ def: makeDark(`${f.name}·深`, f.h, 58), category: '鮮彩・深' })
  generated.push({ def: makeDark(`${f.name}·深柔`, f.h, 32), category: '柔彩・深' })
}
// 中性灰階（低彩度）
generated.push({ def: makeLight('灰·淺', 220, 6), category: '中性' })
generated.push({ def: makeDark('灰·深', 220, 6), category: '中性' })

/** 全部內建主題：招牌 + 生成。 */
export const PRESET_THEMES: ThemeDefinition[] = [...CURATED_THEMES, ...generated.map((g) => g.def)]

/** 內建主題分類（給 UI 分組）。名稱對應分類；沒對到的歸「其他」。 */
export const PRESET_CATEGORY: Record<string, string> = {
  ...CURATED_CATEGORY,
  ...Object.fromEntries(generated.map((g) => [g.def.name, g.category])),
}

export const DEFAULT_THEME: ThemeDefinition = CURATED_THEMES[0]!

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
