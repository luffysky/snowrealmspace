import { describe, it, expect } from 'vitest'
import {
  readPosition,
  readMobileOrder,
  readPositions,
  readMobileItems,
  writePosition,
} from './widget-position.js'

describe('readPosition', () => {
  const pos = { desktop: { x: 1, y: 2, w: 3, h: 4 }, tablet: { x: 5, y: 6, w: 7, h: 8 } }

  it('讀出指定斷點的座標', () => {
    expect(readPosition(pos, 'desktop')).toEqual({ x: 1, y: 2, w: 3, h: 4 })
    expect(readPosition(pos, 'tablet')).toEqual({ x: 5, y: 6, w: 7, h: 8 })
  })
  it('四捨五入', () => {
    expect(readPosition({ desktop: { x: 1.4, y: 2.6, w: 3.5, h: 4.1 } }, 'desktop')).toEqual({ x: 1, y: 3, w: 4, h: 4 })
  })
  it('缺欄位/非物件/缺斷點 → null', () => {
    expect(readPosition({ desktop: { x: 1, y: 2, w: 3 } }, 'desktop')).toBeNull()
    expect(readPosition(null, 'desktop')).toBeNull()
    expect(readPosition('nope', 'desktop')).toBeNull()
    expect(readPosition({ tablet: { x: 1, y: 2, w: 3, h: 4 } }, 'desktop')).toBeNull()
  })
  it('非有限數（NaN/Infinity）→ null', () => {
    expect(readPosition({ desktop: { x: NaN, y: 2, w: 3, h: 4 } }, 'desktop')).toBeNull()
    expect(readPosition({ desktop: { x: 1, y: 2, w: 3, h: Infinity } }, 'desktop')).toBeNull()
  })
})

describe('readMobileOrder', () => {
  it('讀出 order，缺則用 fallback', () => {
    expect(readMobileOrder({ mobile: { order: 3 } }, 9)).toBe(3)
    expect(readMobileOrder({ mobile: {} }, 9)).toBe(9)
    expect(readMobileOrder({}, 9)).toBe(9)
    expect(readMobileOrder(null, 9)).toBe(9)
  })
})

describe('readPositions / readMobileItems', () => {
  const rows = [
    { id: 'a', position: { desktop: { x: 0, y: 0, w: 2, h: 2 }, mobile: { order: 2 } } },
    { id: 'b', position: { mobile: { order: 0 } }, locked: true }, // 無 desktop
    { id: 'c', position: { desktop: { x: 2, y: 0, w: 2, h: 2 }, mobile: { order: 1 } }, locked: true },
  ]
  it('略過沒有該斷點座標的列，保留 locked', () => {
    const items = readPositions(rows, 'desktop')
    expect(items.map((i) => i.id)).toEqual(['a', 'c'])
    expect(items.find((i) => i.id === 'c')).toMatchObject({ locked: true })
    expect(items.find((i) => i.id === 'a')).not.toHaveProperty('locked')
  })
  it('mobile 依 order 排序，缺 order 用索引', () => {
    expect(readMobileItems(rows).map((i) => i.id)).toEqual(['b', 'c', 'a'])
  })
})

describe('writePosition（三斷點各自獨立）', () => {
  it('只改指定斷點，保留其他斷點', () => {
    const existing = { desktop: { x: 1, y: 1, w: 1, h: 1 }, tablet: { x: 9, y: 9, w: 9, h: 9 } }
    const next = writePosition(existing, 'desktop', { x: 5, y: 5, w: 5, h: 5 })
    expect(next.desktop).toEqual({ x: 5, y: 5, w: 5, h: 5 })
    expect(next.tablet).toEqual({ x: 9, y: 9, w: 9, h: 9 }) // 未被動到
  })
  it('mobile 寫 order', () => {
    expect(writePosition({}, 'mobile', { order: 7 }).mobile).toEqual({ order: 7 })
  })
  it('既有非物件時從空白開始', () => {
    expect(writePosition('garbage', 'desktop', { x: 1, y: 1, w: 1, h: 1 }).desktop).toEqual({ x: 1, y: 1, w: 1, h: 1 })
  })
})
