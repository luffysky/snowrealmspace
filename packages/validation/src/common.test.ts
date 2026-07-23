import { describe, it, expect } from 'vitest'
import { hexColorSchema, slugSchema, emailSchema, paginationSchema } from './common.js'

describe('hexColorSchema', () => {
  it('接受 #RRGGBB', () => {
    expect(hexColorSchema.safeParse('#f3a7c3').success).toBe(true)
  })

  /** ADR-020：主題匯入不得成為 CSS 注入管道。 */
  it.each([
    'url(javascript:alert(1))',
    'expression(alert(1))',
    '</style><script>',
    '#fff',
    'red',
  ])('拒絕 %s', (value) => {
    expect(hexColorSchema.safeParse(value).success).toBe(false)
  })
})

describe('slugSchema', () => {
  it('接受合法 slug', () => {
    expect(slugSchema.safeParse('nami-space').success).toBe(true)
  })

  it.each(['-leading', 'UPPER', 'a', 'has space', 'has_underscore'])('拒絕 %s', (v) => {
    expect(slugSchema.safeParse(v).success).toBe(false)
  })
})

describe('emailSchema', () => {
  it('正規化為小寫並去空白', () => {
    expect(emailSchema.parse('  Nami@Example.COM ')).toBe('nami@example.com')
  })
})

describe('paginationSchema', () => {
  it('預設 limit 為 30', () => {
    expect(paginationSchema.parse({}).limit).toBe(30)
  })

  it('limit 上限 100', () => {
    expect(paginationSchema.safeParse({ limit: 500 }).success).toBe(false)
  })
})
