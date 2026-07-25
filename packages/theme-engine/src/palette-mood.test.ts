import { describe, it, expect } from 'vitest'
import { paletteFromMood, buildThemesFromPalette } from './palette.js'

describe('paletteFromMood', () => {
  it('決定性：同一個心情永遠得到同一組色相', () => {
    expect(paletteFromMood('海洋')).toEqual(paletteFromMood('海洋'))
  })

  it('產出的關鍵色都是合法 hex', () => {
    const p = paletteFromMood('森林')
    for (const c of [p.dominant, p.secondary, p.accent, p.darkest, p.lightest]) {
      expect(c).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('不同心情通常給不同主色（不是全部一樣）', () => {
    const moods = ['海洋', '森林', '夜晚', '櫻花', '火焰']
    const doms = new Set(moods.map((m) => paletteFromMood(m).dominant))
    expect(doms.size).toBeGreaterThan(1)
  })

  it('能餵進 buildThemesFromPalette 生出三套變體', () => {
    const variants = buildThemesFromPalette(paletteFromMood('夜晚'), '夜晚')
    expect(variants).toHaveLength(3)
    for (const v of variants) {
      expect(v.definition.colors.background).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})
