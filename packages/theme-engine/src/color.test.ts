import { describe, it, expect } from 'vitest'
import {
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
} from './color.js'

describe('parseColor', () => {
  it('解析 #rrggbb', () => {
    expect(parseColor('#ff8800')).toEqual({ r: 255, g: 136, b: 0, a: 1 })
  })

  it('解析簡寫 #rgb', () => {
    expect(parseColor('#f80')).toEqual({ r: 255, g: 136, b: 0, a: 1 })
  })

  it('解析帶 alpha 的 #rrggbbaa', () => {
    const c = parseColor('#ff880080')
    expect(c?.r).toBe(255)
    expect(c?.a).toBeCloseTo(0.502, 2)
  })

  it('解析 rgb() 與 rgba()', () => {
    expect(parseColor('rgb(255, 136, 0)')).toEqual({ r: 255, g: 136, b: 0, a: 1 })
    expect(parseColor('rgba(255, 136, 0, 0.5)')).toEqual({ r: 255, g: 136, b: 0, a: 0.5 })
  })

  it('容忍空白與大小寫', () => {
    expect(parseColor('  #FF8800  ')).toEqual({ r: 255, g: 136, b: 0, a: 1 })
  })

  it.each(['', 'red', 'url(x)', '#gg0000', 'rgb(1)', 'javascript:alert(1)'])(
    '無法解析時回 null：%s',
    (input) => {
      expect(parseColor(input)).toBeNull()
    },
  )
})

describe('toHex / toRgbaString', () => {
  it('往返一致', () => {
    expect(toHex(parseColor('#3a7bd5')!)).toBe('#3a7bd5')
  })

  it('超出範圍會夾住而非溢位', () => {
    expect(toHex({ r: 300, g: -10, b: 128 })).toBe('#ff0080')
  })

  it('rgba 字串格式正確', () => {
    expect(toRgbaString({ r: 255, g: 0, b: 0, a: 0.5 })).toBe('rgba(255, 0, 0, 0.5)')
  })
})

describe('compositeOver', () => {
  it('全不透明時等於前景', () => {
    const r = compositeOver({ r: 10, g: 20, b: 30, a: 1 }, { r: 200, g: 200, b: 200 })
    expect(r).toEqual({ r: 10, g: 20, b: 30 })
  })

  it('全透明時等於背景', () => {
    const r = compositeOver({ r: 10, g: 20, b: 30, a: 0 }, { r: 200, g: 200, b: 200 })
    expect(r).toEqual({ r: 200, g: 200, b: 200 })
  })

  it('半透明取中間值', () => {
    const r = compositeOver({ r: 0, g: 0, b: 0, a: 0.5 }, { r: 200, g: 200, b: 200 })
    expect(r.r).toBeCloseTo(100)
  })
})

describe('relativeLuminance', () => {
  it('黑為 0、白為 1', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0)
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1)
  })
})

describe('contrastRatio', () => {
  it('黑白對比為 21:1（WCAG 上限）', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1)
  })

  it('同色對比為 1:1', () => {
    expect(contrastRatio('#3a7bd5', '#3a7bd5')).toBeCloseTo(1, 2)
  })

  it('前後順序不影響結果', () => {
    expect(contrastRatio('#333333', '#eeeeee')).toBeCloseTo(
      contrastRatio('#eeeeee', '#333333'),
      5,
    )
  })

  /**
   * 這是最容易寫錯的一項：半透明前景必須先與背景合成。
   * 直接拿 rgba 的 RGB 值算會得到明顯偏高的比值。
   */
  it('半透明前景會先與背景合成', () => {
    const naive = contrastRatio('#ffffff', '#000000') // 21
    const actual = contrastRatio('rgba(255,255,255,0.1)', '#000000')
    expect(actual).toBeLessThan(naive)
    expect(actual).toBeLessThan(3)
  })

  it('無法解析的顏色回 1（最保守，會被判為不合格）', () => {
    expect(contrastRatio('not-a-color', '#ffffff')).toBe(1)
  })
})

describe('rgbToHsl / hslToRgb', () => {
  it('往返誤差在容忍範圍內', () => {
    const original = { r: 58, g: 123, b: 213 }
    const back = hslToRgb(rgbToHsl(original))
    expect(back.r).toBeCloseTo(original.r, 0)
    expect(back.g).toBeCloseTo(original.g, 0)
    expect(back.b).toBeCloseTo(original.b, 0)
  })

  it('灰階的飽和度為 0', () => {
    expect(rgbToHsl({ r: 128, g: 128, b: 128 }).s).toBe(0)
  })

  it('灰階可正確還原', () => {
    const rgb = hslToRgb({ h: 0, s: 0, l: 0.5 })
    expect(rgb.r).toBeCloseTo(127.5)
    expect(rgb.r).toBe(rgb.g)
  })

  it.each([
    [{ r: 255, g: 0, b: 0 }, 0],
    [{ r: 0, g: 255, b: 0 }, 120],
    [{ r: 0, g: 0, b: 255 }, 240],
  ])('色相正確：%o → %i', (rgb, hue) => {
    expect(rgbToHsl(rgb).h).toBeCloseTo(hue, 0)
  })
})

describe('adjustLightness', () => {
  it('正值變亮、負值變暗', () => {
    const base = '#3a7bd5'
    expect(relativeLuminance(parseColor(adjustLightness(base, 0.2))!)).toBeGreaterThan(
      relativeLuminance(parseColor(base)!),
    )
    expect(relativeLuminance(parseColor(adjustLightness(base, -0.2))!)).toBeLessThan(
      relativeLuminance(parseColor(base)!),
    )
  })

  it('保留 alpha', () => {
    expect(adjustLightness('rgba(58, 123, 213, 0.5)', 0.1)).toContain('0.5')
  })

  it('無法解析時原樣回傳', () => {
    expect(adjustLightness('nope', 0.2)).toBe('nope')
  })

  it('不會超出 0–1 的明度範圍', () => {
    expect(parseColor(adjustLightness('#ffffff', 0.5))).toBeTruthy()
    expect(parseColor(adjustLightness('#000000', -0.5))).toBeTruthy()
  })
})

describe('pickReadableForeground', () => {
  it('淺背景選深色', () => {
    expect(pickReadableForeground('#ffffff')).toBe('#1a1a1a')
  })

  it('深背景選淺色', () => {
    expect(pickReadableForeground('#111111')).toBe('#ffffff')
  })

  it('選出的顏色對比一定較高', () => {
    for (const bg of ['#ffffff', '#000000', '#3a7bd5', '#f3a7c3', '#7f7f7f']) {
      const picked = pickReadableForeground(bg)
      const other = picked === '#ffffff' ? '#1a1a1a' : '#ffffff'
      expect(contrastRatio(picked, bg)).toBeGreaterThanOrEqual(contrastRatio(other, bg))
    }
  })
})

describe('ensureContrast', () => {
  it('已達標時原樣回傳', () => {
    expect(ensureContrast('#000000', '#ffffff', 4.5)).toBe('#000000')
  })

  it('未達標時調整到達標', () => {
    const result = ensureContrast('#cccccc', '#ffffff', 4.5)
    expect(contrastRatio(result, '#ffffff')).toBeGreaterThanOrEqual(4.5)
  })

  it('深背景上也能達標', () => {
    const result = ensureContrast('#333333', '#000000', 4.5)
    expect(contrastRatio(result, '#000000')).toBeGreaterThanOrEqual(4.5)
  })

  it('保留色相 —— 不會把彩色變成黑白', () => {
    const result = ensureContrast('#d4739a', '#ffffff', 4.5)
    const hsl = rgbToHsl(parseColor(result)!)
    const originalHsl = rgbToHsl(parseColor('#d4739a')!)
    expect(hsl.h).toBeCloseTo(originalHsl.h, 0)
    expect(hsl.s).toBeGreaterThan(0.1)
  })

  it('目標不可能達成時回傳最接近的，而不是拋錯', () => {
    // 21:1 只有純黑白做得到；要求 21 而背景是中灰時無解
    const result = ensureContrast('#808080', '#808080', 21)
    expect(parseColor(result)).toBeTruthy()
  })

  it('無法解析的輸入原樣回傳', () => {
    expect(ensureContrast('bogus', '#ffffff', 4.5)).toBe('bogus')
    expect(ensureContrast('#000000', 'bogus', 4.5)).toBe('#000000')
  })
})
