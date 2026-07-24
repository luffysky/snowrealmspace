import { describe, it, expect } from 'vitest'
import { compareLocalFeatures, colorDistance } from './compare.js'

describe('colorDistance', () => {
  it('相同顏色距離為 0', () => {
    expect(colorDistance('#ffffff', '#ffffff')).toBe(0)
  })

  it('黑對白距離為 100', () => {
    expect(colorDistance('#000000', '#ffffff')).toBe(100)
  })

  it('可重現：同輸入同輸出', () => {
    expect(colorDistance('#ff0000', '#00ff00')).toBe(colorDistance('#ff0000', '#00ff00'))
  })

  it('無效或缺色回 null', () => {
    expect(colorDistance('nope', '#fff')).toBeNull()
    expect(colorDistance(undefined, '#fff')).toBeNull()
  })
})

describe('compareLocalFeatures', () => {
  it('計算尺寸差異', () => {
    const r = compareLocalFeatures(
      { dimensions: { width: 1000, height: 500, aspectRatio: 2 } },
      { dimensions: { width: 1200, height: 500, aspectRatio: 2.4 } },
    )
    expect(r.dimensions.widthDelta).toBe(200)
    expect(r.dimensions.heightDelta).toBe(0)
    expect(r.dimensions.aspectRatioDelta).toBe(0.4)
  })

  it('計算顏色距離與統計差異（巢狀結構，對齊 asset.process）', () => {
    const r = compareLocalFeatures(
      { colors: { dominant: '#000000' }, composition: { averageLightness: 0.2, isDark: true } },
      { colors: { dominant: '#ffffff' }, composition: { averageLightness: 0.8, isDark: false } },
    )
    expect(r.colors.dominant.distance).toBe(100)
    expect(r.colors.dominant.from).toBe('#000000')
    expect(r.colors.dominant.to).toBe('#ffffff')
    expect(r.stats.lightnessDelta).toBe(0.6)
    expect(r.stats.isDarkChanged).toBe(true)
  })

  it('缺欄位時對應差異為 null，不拋錯', () => {
    const r = compareLocalFeatures({}, {})
    expect(r.dimensions.widthDelta).toBeNull()
    expect(r.colors.accent.distance).toBeNull()
    expect(r.stats.isDarkChanged).toBeNull()
  })
})
