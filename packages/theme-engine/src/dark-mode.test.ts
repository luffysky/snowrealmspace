import { describe, it, expect } from 'vitest'
import { deriveDarkTheme, deriveLightTheme, effectiveTheme, isDarkTheme } from './dark-mode.js'
import { defaultThemeDefinition } from './presets.js'
import { relativeLuminance, parseColor, contrastRatio, rgbToHsl } from './color.js'

function lum(hex: string): number {
  const p = parseColor(hex)
  return p ? relativeLuminance(p) : 0
}

describe('deriveDarkTheme', () => {
  const light = defaultThemeDefinition()
  const dark = deriveDarkTheme(light)

  it('背景變暗、文字變亮', () => {
    expect(lum(dark.colors.background)).toBeLessThan(lum(light.colors.background))
    expect(lum(dark.colors.textPrimary)).toBeGreaterThan(0.5)
  })

  it('文字對背景有足夠對比（可讀）', () => {
    expect(contrastRatio(dark.colors.textPrimary, dark.colors.background)).toBeGreaterThanOrEqual(
      4.5,
    )
  })

  it('只改顏色，字體/材質/動態不動', () => {
    expect(dark.typography).toEqual(light.typography)
    expect(dark.surfaces).toEqual(light.surfaces)
    expect(dark.motion).toEqual(light.motion)
  })

  it('強調色在暗底上不會消失（有對比）', () => {
    expect(contrastRatio(dark.colors.accent, dark.colors.background)).toBeGreaterThan(2)
  })

  it('每個顏色都仍是合法可解析的顏色', () => {
    for (const value of Object.values(dark.colors)) {
      expect(parseColor(value)).not.toBeNull()
    }
  })

  it('卡片走中性（低飽和），不是深彩色底 —— 修「淺粉紅切深色還是粉紅」', () => {
    const p = parseColor(dark.colors.surface)!
    // surface 飽和度應該被壓得很低（中性深灰），不再保留原主題的高飽和
    expect(rgbToHsl(p).s).toBeLessThan(0.3)
  })
})

describe('isDarkTheme', () => {
  it('預設淺色主題 → false，其深色版 → true', () => {
    const light = defaultThemeDefinition()
    expect(isDarkTheme(light)).toBe(false)
    expect(isDarkTheme(deriveDarkTheme(light))).toBe(true)
  })
})

describe('deriveLightTheme', () => {
  const darkBase = deriveDarkTheme(defaultThemeDefinition())
  const light = deriveLightTheme(darkBase)

  it('深色主題 → 淺色版：背景變亮、文字變暗', () => {
    const bg = parseColor(light.colors.background)!
    const text = parseColor(light.colors.textPrimary)!
    expect(relativeLuminance(bg)).toBeGreaterThan(relativeLuminance(parseColor(darkBase.colors.background)!))
    expect(relativeLuminance(text)).toBeLessThan(0.3)
  })

  it('文字對背景可讀（≥ 4.5）', () => {
    expect(contrastRatio(light.colors.textPrimary, light.colors.background)).toBeGreaterThanOrEqual(4.5)
  })
})

describe('effectiveTheme', () => {
  const light = defaultThemeDefinition()

  it('淺色底：淺色模式原樣、深色模式推導成深', () => {
    expect(effectiveTheme(light, 'light')).toEqual(light)
    expect(isDarkTheme(effectiveTheme(light, 'dark'))).toBe(true)
  })

  it('深色底：深色模式原樣、淺色模式推導成淺（不會維持深色）', () => {
    const darkBase = deriveDarkTheme(light)
    expect(effectiveTheme(darkBase, 'dark')).toEqual(darkBase)
    expect(isDarkTheme(effectiveTheme(darkBase, 'light'))).toBe(false)
  })
})
