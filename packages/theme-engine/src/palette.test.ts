import { describe, it, expect } from 'vitest'
import { extractPalette, buildThemesFromPalette, palettesEqual } from './palette.js'
import { analyzeTheme } from './contrast.js'
import { contrastRatio, parseColor } from './color.js'
import { themeDefinitionSchema } from './schema.js'

/** 產生 RGBA 平面陣列。 */
function pixels(colors: [number, number, number][], repeat = 1): Uint8Array {
  const out = new Uint8Array(colors.length * repeat * 4)
  let i = 0
  for (let r = 0; r < repeat; r++) {
    for (const [red, green, blue] of colors) {
      out[i++] = red
      out[i++] = green
      out[i++] = blue
      out[i++] = 255
    }
  }
  return out
}

const PINK: [number, number, number] = [243, 167, 195]
const DEEP: [number, number, number] = [140, 88, 112]
const CREAM: [number, number, number] = [255, 247, 251]
const NAVY: [number, number, number] = [20, 23, 31]

describe('extractPalette', () => {
  it('抽出主要色', () => {
    const p = extractPalette(pixels([PINK, PINK, PINK, DEEP], 40))
    expect(p.swatches.length).toBeGreaterThan(0)
    expect(parseColor(p.dominant)).toBeTruthy()
  })

  /**
   * 這是最重要的一項。
   * 同一張圖每次取出不同顏色，使用者會覺得系統壞了。
   */
  it('確定性：同樣的輸入必得完全相同的結果', () => {
    const input = pixels([PINK, DEEP, CREAM, NAVY], 30)
    const a = extractPalette(input)
    const b = extractPalette(input)
    expect(a).toEqual(b)
    expect(palettesEqual(a, b)).toBe(true)
  })

  it('確定性：跑十次結果一致', () => {
    const input = pixels([PINK, DEEP, CREAM, NAVY, [100, 200, 150]], 20)
    const first = extractPalette(input)
    for (let i = 0; i < 9; i++) {
      expect(extractPalette(input).swatches).toEqual(first.swatches)
    }
  })

  it('swatches 依權重由大到小排序', () => {
    const p = extractPalette(pixels([PINK, PINK, PINK, PINK, DEEP], 30))
    for (let i = 1; i < p.swatches.length; i++) {
      expect(p.swatches[i - 1]!.weight).toBeGreaterThanOrEqual(p.swatches[i]!.weight)
    }
  })

  it('權重總和約為 1', () => {
    const p = extractPalette(pixels([PINK, DEEP, CREAM], 40))
    const total = p.swatches.reduce((s, x) => s + x.weight, 0)
    expect(total).toBeCloseTo(1, 5)
  })

  it('darkest 比 lightest 暗', () => {
    const p = extractPalette(pixels([CREAM, NAVY, PINK], 40))
    const dark = parseColor(p.darkest)!
    const light = parseColor(p.lightest)!
    expect(dark.r + dark.g + dark.b).toBeLessThan(light.r + light.g + light.b)
  })

  it('忽略幾乎透明的像素', () => {
    const opaque = pixels([PINK], 20)
    const withTransparent = new Uint8Array(opaque.length + 40)
    withTransparent.set(opaque)
    // 追加 10 個全透明的綠色像素，不該影響結果
    for (let i = 0; i < 10; i++) {
      const o = opaque.length + i * 4
      withTransparent[o] = 0
      withTransparent[o + 1] = 255
      withTransparent[o + 2] = 0
      withTransparent[o + 3] = 0
    }
    expect(extractPalette(withTransparent).swatches).toEqual(extractPalette(opaque).swatches)
  })

  it('空輸入回傳預設值而非拋錯', () => {
    const p = extractPalette(new Uint8Array(0))
    expect(p.stats.colorCount).toBe(0)
    expect(parseColor(p.dominant)).toBeTruthy()
  })

  it('全透明輸入也不拋錯', () => {
    const transparent = new Uint8Array(40) // 全 0，含 alpha
    expect(() => extractPalette(transparent)).not.toThrow()
  })

  it('單一顏色的圖只有一個叢集', () => {
    const p = extractPalette(pixels([PINK], 100))
    expect(p.stats.colorCount).toBe(1)
  })

  it('叢集數不超過像素數', () => {
    const p = extractPalette(pixels([PINK, DEEP], 1), 5)
    expect(p.stats.colorCount).toBeLessThanOrEqual(2)
  })

  it('統計數據在合理範圍內', () => {
    const p = extractPalette(pixels([PINK, DEEP, CREAM], 40))
    expect(p.stats.averageSaturation).toBeGreaterThanOrEqual(0)
    expect(p.stats.averageSaturation).toBeLessThanOrEqual(1)
    expect(p.stats.averageLightness).toBeGreaterThanOrEqual(0)
    expect(p.stats.averageLightness).toBeLessThanOrEqual(1)
  })

  it('深色圖被標記為 isDark', () => {
    expect(extractPalette(pixels([NAVY], 50)).stats.isDark).toBe(true)
    expect(extractPalette(pixels([CREAM], 50)).stats.isDark).toBe(false)
  })

  it('所有輸出的顏色都是合法 hex', () => {
    const p = extractPalette(pixels([PINK, DEEP, CREAM, NAVY], 30))
    for (const c of [p.dominant, p.secondary, p.accent, p.darkest, p.lightest]) {
      expect(c).toMatch(/^#[0-9a-f]{6}$/i)
    }
    for (const s of p.swatches) expect(s.color).toMatch(/^#[0-9a-f]{6}$/i)
  })
})

describe('buildThemesFromPalette', () => {
  const palette = extractPalette(pixels([PINK, DEEP, CREAM, NAVY], 40))

  it('產生三個變體', () => {
    const themes = buildThemesFromPalette(palette)
    expect(themes).toHaveLength(3)
    expect(themes.map((t) => t.variant)).toEqual(['明亮', '柔和', '深色'])
  })

  /**
   * 取色結果不保證可讀 —— 這是 from_image 最容易出錯的地方。
   * 每個變體最後都必須通過對比檢查。
   */
  it('每個變體的主要文字都達到 AA', () => {
    for (const { definition, variant } of buildThemesFromPalette(palette)) {
      expect(
        contrastRatio(definition.colors.textPrimary, definition.colors.background),
        `${variant} 的主要文字`,
      ).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('每個變體的次要文字也達到 AA', () => {
    for (const { definition, variant } of buildThemesFromPalette(palette)) {
      expect(
        contrastRatio(definition.colors.textSecondary, definition.colors.background),
        `${variant} 的次要文字`,
      ).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('每個變體都通過完整的 A11y 報告', () => {
    for (const { definition, variant } of buildThemesFromPalette(palette)) {
      const report = analyzeTheme(definition)
      expect(report.passesAA, `${variant}：${report.failing.join('、')}`).toBe(true)
    }
  })

  it('每個變體都通過 schema 驗證（可安全存進資料庫）', () => {
    for (const { definition, variant } of buildThemesFromPalette(palette)) {
      const result = themeDefinitionSchema.safeParse(definition)
      expect(result.success, `${variant}：${JSON.stringify(result.error?.issues)}`).toBe(true)
    }
  })

  it('深色變體的背景真的是深的', () => {
    const dark = buildThemesFromPalette(palette).find((t) => t.variant === '深色')!
    const bg = parseColor(dark.definition.colors.background)!
    expect((bg.r + bg.g + bg.b) / 3).toBeLessThan(128)
  })

  it('明亮變體的背景真的是亮的', () => {
    const light = buildThemesFromPalette(palette).find((t) => t.variant === '明亮')!
    const bg = parseColor(light.definition.colors.background)!
    expect((bg.r + bg.g + bg.b) / 3).toBeGreaterThan(200)
  })

  it('名稱包含使用者給的基底名', () => {
    const themes = buildThemesFromPalette(palette, '六月海報')
    expect(themes.every((t) => t.definition.name.startsWith('六月海報'))).toBe(true)
  })

  it('確定性：相同色票必得相同主題', () => {
    expect(buildThemesFromPalette(palette)).toEqual(buildThemesFromPalette(palette))
  })

  /**
   * 極端輸入（純白、純黑、純灰）最容易產生不可讀的結果。
   * 這些案例必須也能產出合格主題。
   */
  it.each([
    ['純白', [[255, 255, 255]] as [number, number, number][]],
    ['純黑', [[0, 0, 0]] as [number, number, number][]],
    ['中灰', [[128, 128, 128]] as [number, number, number][]],
    ['高飽和紅', [[255, 0, 0]] as [number, number, number][]],
    ['低對比灰階', [[200, 200, 200], [210, 210, 210]] as [number, number, number][]],
  ])('極端輸入「%s」仍產出合格主題', (_label, colors) => {
    const p = extractPalette(pixels(colors, 50))
    for (const { definition, variant } of buildThemesFromPalette(p)) {
      const report = analyzeTheme(definition)
      expect(report.passesAA, `${variant}：${report.failing.join('、')}`).toBe(true)
    }
  })
})
