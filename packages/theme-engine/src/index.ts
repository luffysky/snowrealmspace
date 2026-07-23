export type {
  ThemeDefinition,
  ThemeColors,
  ThemeTypography,
  ThemeSurfaces,
  ThemeEffects,
  ThemeMotion,
  SurfaceStyle,
  ShadowPreset,
  MotionPreset,
  ContrastSize,
  ContrastPair,
  A11yReport,
  HexColor,
  RgbaColor,
} from './types.js'

export {
  parseColor,
  toHex,
  toRgbaString,
  compositeOver,
  relativeLuminance,
  contrastRatio,
  rgbToHsl,
  hslToRgb,
  adjustLightness,
  pickReadableForeground,
  ensureContrast,
  type Rgb,
  type Rgba,
  type Hsl,
} from './color.js'

export { THRESHOLDS, wcagLevel, analyzeTheme, flattenSurface, suggestFix } from './contrast.js'

export {
  compileThemeToCssVars,
  compileThemeToCssText,
  themeDataAttributes,
  computeA11yFallback,
  type A11yFallback,
} from './compile.js'

export {
  themeDefinitionSchema,
  themeColorsSchema,
  themeExportSchema,
  type ThemeExport,
} from './schema.js'

export { PRESET_THEMES, DEFAULT_THEME, defaultThemeDefinition, NEUTRAL } from './presets.js'

export { extractPalette, buildThemesFromPalette, type Palette } from './palette.js'
