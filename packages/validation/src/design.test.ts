import { describe, it, expect } from 'vitest'
import {
  designFileCreateSchema,
  designFilePatchSchema,
  snapshotCreateSchema,
  snapshotCompareSchema,
} from './design.js'

const UUID = '11111111-1111-1111-1111-111111111111'
const UUID2 = '22222222-2222-2222-2222-222222222222'

describe('designFileCreateSchema', () => {
  it('接受 assetId + title', () => {
    const r = designFileCreateSchema.parse({ assetId: UUID, title: '海報' })
    expect(r.assetId).toBe(UUID)
    expect(r.title).toBe('海報')
  })

  it('assetId 必須是 uuid', () => {
    expect(designFileCreateSchema.safeParse({ assetId: 'x', title: 'a' }).success).toBe(false)
  })

  it('空標題被拒', () => {
    expect(designFileCreateSchema.safeParse({ assetId: UUID, title: '  ' }).success).toBe(false)
  })

  it('拒絕多餘欄位（strict）', () => {
    expect(
      designFileCreateSchema.safeParse({ assetId: UUID, title: 'a', space_id: 'x' }).success,
    ).toBe(false)
  })

  it('標籤小寫去重', () => {
    const r = designFileCreateSchema.parse({ assetId: UUID, title: 'a', tags: ['A', 'a'] })
    expect(r.tags).toEqual(['a'])
  })
})

describe('designFilePatchSchema', () => {
  it('空 patch 被拒', () => {
    expect(designFilePatchSchema.safeParse({}).success).toBe(false)
  })
  it('可只改 projectId 為 null（解除歸屬）', () => {
    expect(designFilePatchSchema.parse({ projectId: null }).projectId).toBeNull()
  })
})

describe('snapshotCreateSchema', () => {
  it('需要 assetId', () => {
    expect(snapshotCreateSchema.safeParse({}).success).toBe(false)
    expect(snapshotCreateSchema.parse({ assetId: UUID }).assetId).toBe(UUID)
  })
})

describe('snapshotCompareSchema', () => {
  it('兩個不同 uuid', () => {
    expect(snapshotCompareSchema.parse({ a: UUID, b: UUID2 }).a).toBe(UUID)
  })
  it('相同版本被拒', () => {
    expect(snapshotCompareSchema.safeParse({ a: UUID, b: UUID }).success).toBe(false)
  })
})
