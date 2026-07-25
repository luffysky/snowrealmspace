import { describe, it, expect } from 'vitest'
import { birthdayCardFor } from './birthday-cards'

describe('birthdayCardFor', () => {
  it('同一個 seed 永遠得到同一張卡（決定性）', () => {
    const a = birthdayCardFor('space-123')
    const b = birthdayCardFor('space-123')
    expect(a).toEqual(b)
  })

  it('不同 seed 會分散到不同卡（至少不是全部同一張）', () => {
    const seeds = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    const titles = new Set(seeds.map((s) => birthdayCardFor(s).title))
    expect(titles.size).toBeGreaterThan(1)
  })

  it('每張卡都有標題與至少一行內容', () => {
    for (const seed of ['x', 'y', 'z', 'space-owner', 'nami']) {
      const card = birthdayCardFor(seed)
      expect(card.title.length).toBeGreaterThan(0)
      expect(card.lines.length).toBeGreaterThan(0)
      expect(card.lines.every((l) => l.trim().length > 0)).toBe(true)
    }
  })
})
