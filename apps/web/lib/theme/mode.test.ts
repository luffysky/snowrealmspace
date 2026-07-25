import { describe, it, expect } from 'vitest'
import { parseMode } from './mode.js'

describe('parseMode', () => {
  it('只有 "dark" 是 dark，其餘一律 light（安全預設）', () => {
    expect(parseMode('dark')).toBe('dark')
    expect(parseMode('light')).toBe('light')
    expect(parseMode('')).toBe('light')
    expect(parseMode('DARK')).toBe('light') // 大小寫敏感
    expect(parseMode('garbage')).toBe('light')
    expect(parseMode(undefined)).toBe('light')
    expect(parseMode(null)).toBe('light')
  })
})
