import { describe, it, expect } from 'vitest'
import { passwordStrength, PASSWORD_MIN_LENGTH } from './password.js'

describe('passwordStrength', () => {
  it('空字串 → score 0、不可接受、無提示', () => {
    const r = passwordStrength('')
    expect(r.score).toBe(0)
    expect(r.acceptable).toBe(false)
    expect(r.hint).toBeNull()
  })

  it('太短 → 不可接受，提示長度', () => {
    const r = passwordStrength('abc123')
    expect(r.acceptable).toBe(false)
    expect(r.hint).toContain(String(PASSWORD_MIN_LENGTH))
  })

  it('剛好 8 字純字母 → 可接受但強度不高', () => {
    const r = passwordStrength('abcdefgh')
    expect(r.acceptable).toBe(true)
    expect(r.score).toBeLessThanOrEqual(2)
  })

  it('長且多種字元 → 高分', () => {
    const r = passwordStrength('Str0ng!Passphrase#2026')
    expect(r.acceptable).toBe(true)
    expect(r.score).toBeGreaterThanOrEqual(3)
  })

  it('全同一個字元 → 被壓到很弱', () => {
    const r = passwordStrength('aaaaaaaaaaaa')
    expect(r.score).toBeLessThanOrEqual(1)
  })

  it('常見序列/字典字被壓分', () => {
    expect(passwordStrength('password1234').score).toBeLessThanOrEqual(1)
    expect(passwordStrength('nami0724nami').score).toBeLessThanOrEqual(1)
  })

  it('達標的密碼沒有多餘提示', () => {
    expect(passwordStrength('Mix3d-Good-Pass').hint).toBeNull()
  })
})
