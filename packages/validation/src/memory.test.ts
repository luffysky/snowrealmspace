import { describe, it, expect } from 'vitest'
import { memoryCreateSchema, memoryPatchSchema, memoryListQuerySchema } from './memory.js'

describe('memoryCreateSchema', () => {
  it('接受內容、預設 note/normal', () => {
    const r = memoryCreateSchema.parse({ content: '喜歡暖色' })
    expect(r.type).toBe('note')
    expect(r.sensitivity).toBe('normal')
  })
  it('空內容被拒', () => {
    expect(memoryCreateSchema.safeParse({ content: '   ' }).success).toBe(false)
  })
  it('未知敏感度被拒', () => {
    expect(memoryCreateSchema.safeParse({ content: 'x', sensitivity: 'secret' }).success).toBe(false)
  })
  it('拒絕多餘欄位（strict，防夾帶 approved）', () => {
    expect(memoryCreateSchema.safeParse({ content: 'x', approved: true }).success).toBe(false)
  })
})

describe('memoryPatchSchema', () => {
  it('空 patch 被拒', () => {
    expect(memoryPatchSchema.safeParse({}).success).toBe(false)
  })
  it('可只改敏感度', () => {
    expect(memoryPatchSchema.parse({ sensitivity: 'restricted' }).sensitivity).toBe('restricted')
  })
})

describe('memoryListQuerySchema', () => {
  it('status 預設 approved', () => {
    expect(memoryListQuerySchema.parse({}).status).toBe('approved')
  })
})
