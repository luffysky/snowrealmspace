import { describe, it, expect } from 'vitest'
import { deriveDarkTheme } from './dark-mode.js'
import { defaultThemeDefinition } from './presets.js'
import { relativeLuminance, parseColor, contrastRatio } from './color.js'

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
})
