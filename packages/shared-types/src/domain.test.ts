import { describe, it, expect } from 'vitest'
import { toSpaceRole, toSpacePrivacy, FEATURE_FLAG_KEYS } from './domain.js'

describe('toSpaceRole', () => {
  it.each(['owner', 'collaborator', 'guest'] as const)('原樣通過合法值 %s', (role) => {
    expect(toSpaceRole(role)).toBe(role)
  })

  it('未知值降級為 guest（最小權限），而不是拋錯', () => {
    expect(toSpaceRole('superadmin')).toBe('guest')
    expect(toSpaceRole('')).toBe('guest')
  })
})

describe('toSpacePrivacy', () => {
  it.each(['private', 'unlisted', 'public'] as const)('原樣通過合法值 %s', (v) => {
    expect(toSpacePrivacy(v)).toBe(v)
  })

  it('未知值降級為 private（最保守），而不是拋錯', () => {
    expect(toSpacePrivacy('everyone')).toBe('private')
  })
})

describe('FEATURE_FLAG_KEYS', () => {
  it('沒有重複的 key', () => {
    expect(new Set(FEATURE_FLAG_KEYS).size).toBe(FEATURE_FLAG_KEYS.length)
  })

  it('涵蓋 v1.0 §47 列出的全部 flag', () => {
    const required = [
      'figmaIntegration',
      'canvaConnect',
      'canvaApp',
      'adobeExpress',
      'photoshopPlugin',
      'publicPortfolio',
      'collaboration',
      'marketplace',
    ]
    for (const key of required) {
      expect(FEATURE_FLAG_KEYS).toContain(key)
    }
  })
})
