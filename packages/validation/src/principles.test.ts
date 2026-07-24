import { describe, it, expect } from 'vitest'
import { principleCreateSchema, principlePatchSchema, principleReorderSchema } from './principles.js'

describe('principleCreateSchema', () => {
  it('接受標題', () => {
    expect(principleCreateSchema.parse({ title: '留白比內容重要' }).title).toBe('留白比內容重要')
  })
  it('空標題被拒', () => {
    expect(principleCreateSchema.safeParse({ title: '  ' }).success).toBe(false)
  })
  it('拒絕多餘欄位（strict）', () => {
    expect(principleCreateSchema.safeParse({ title: 'x', position: 5 }).success).toBe(false)
  })
})

describe('principlePatchSchema', () => {
  it('空 patch 被拒', () => {
    expect(principlePatchSchema.safeParse({}).success).toBe(false)
  })
})

describe('principleReorderSchema', () => {
  it('需要非空 uuid 陣列', () => {
    expect(principleReorderSchema.safeParse({ orderedIds: [] }).success).toBe(false)
    expect(
      principleReorderSchema.safeParse({ orderedIds: ['11111111-1111-1111-1111-111111111111'] })
        .success,
    ).toBe(true)
  })
})
