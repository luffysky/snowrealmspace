import { describe, it, expect } from 'vitest'
import { rarityLabel, DAILY_WEIGHTS, PITY_THRESHOLD } from './shared.js'

describe('rarityLabel', () => {
  it('對應中文標籤', () => {
    expect(rarityLabel('common')).toBe('平凡')
    expect(rarityLabel('rare')).toBe('稀有')
    expect(rarityLabel('anniversary')).toBe('週年')
  })
  it('未知稀有度回原字串', () => {
    expect(rarityLabel('mystery')).toBe('mystery')
  })
})

describe('DAILY_WEIGHTS / PITY_THRESHOLD', () => {
  it('每日隨機只含 common/uncommon/rare（special/anniversary 條件觸發）', () => {
    expect(Object.keys(DAILY_WEIGHTS).sort()).toEqual(['common', 'rare', 'uncommon'])
  })
  it('權重加總 100', () => {
    expect(Object.values(DAILY_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100)
  })
  it('保底門檻為 15', () => {
    expect(PITY_THRESHOLD).toBe(15)
  })
})
