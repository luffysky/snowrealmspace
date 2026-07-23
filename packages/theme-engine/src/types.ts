/**
 * ThemeDefinition。見 docs/spec/05-theme-tokens.md §1。
 *
 * 與 v1.0 §11.2 的差異：
 *   + schemaVersion —— 匯入時判版本
 *   + colors.focusRing —— ADR-011 需要獨立 token，
 *     不能沿用 primary（primary 可能與背景對比不足）
 */

export type HexColor = string
export type RgbaColor = string

export type SurfaceStyle = 'solid' | 'glass' | 'soft' | 'outline'
export type ShadowPreset = 'none' | 'soft' | 'medium' | 'dramatic'
export type MotionPreset = 'none' | 'soft' | 'float' | 'playful' | 'cinematic'

export type ThemeColors = {
  primary: HexColor
  secondary: HexColor
  accent: HexColor
  background: HexColor
  surface: RgbaColor
  surfaceAlt: RgbaColor
  textPrimary: HexColor
  textSecondary: HexColor
  border: RgbaColor
  success: HexColor
  warning: HexColor
  danger: HexColor
  focusRing: HexColor
}

export type ThemeTypography = {
  headingFontId: string
  bodyFontId: string
  uiFontId: string
  monoFontId?: string | undefined
  headingScale: number
  bodyScale: number
  lineHeight: number
  letterSpacing: number
}

export type ThemeSurfaces = {
  style: SurfaceStyle
  opacity: number
  blur: number
  radius: number
  borderWidth: number
}

export type ThemeEffects = {
  shadow: ShadowPreset
  glow: boolean
  noise: boolean
}

export type ThemeMotion = {
  preset: MotionPreset
  intensity: number
  reduceMotionFallback: boolean
}

export type ThemeDefinition = {
  schemaVersion: 1
  name: string
  colors: ThemeColors
  typography: ThemeTypography
  surfaces: ThemeSurfaces
  effects: ThemeEffects
  motion: ThemeMotion
  backgroundPlaylistId?: string | undefined
}

/** 對比檢查用的文字尺寸類別（ADR-011 的門檻依此區分）。 */
export type ContrastSize = 'normal' | 'large' | 'ui'

export type ContrastPair = {
  label: string
  fg: string
  bg: string
  size: ContrastSize
  ratio: number
  required: number
  level: 'fail' | 'AA' | 'AAA'
  /**
   * 參考用，不計入 passesAA。
   *
   * WCAG 1.4.11 只規範「識別 UI 元件與狀態所必需」的視覺資訊。
   * 卡片的裝飾性邊框不屬於此類 —— 卡片是靠底色與陰影辨識的，
   * 不是靠邊框。強制它達到 3:1 會逼出過重的邊框，反而傷害設計。
   *
   * 但 focus ring、表單輸入框邊界屬於必需資訊，**不是** advisory。
   */
  advisory?: boolean | undefined
}

export type A11yReport = {
  pairs: ContrastPair[]
  worstRatio: number
  passesAA: boolean
  /** 未達 AA 且非 advisory 的組合。UI 用來顯示具體哪裡要改。 */
  failing: string[]
  /** 未達標但屬於參考性質的組合。UI 可以較低調地顯示。 */
  advisories: string[]
}
