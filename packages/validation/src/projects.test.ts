import { describe, it, expect } from 'vitest'
import {
  projectCreateSchema,
  projectPatchSchema,
  projectListQuerySchema,
} from './projects.js'

describe('projectCreateSchema', () => {
  it('接受最小輸入並帶入預設狀態 idea', () => {
    const r = projectCreateSchema.parse({ name: '六月海報' })
    expect(r.status).toBe('idea')
    expect(r.name).toBe('六月海報')
  })

  it('修剪名稱前後空白', () => {
    expect(projectCreateSchema.parse({ name: '  海報  ' }).name).toBe('海報')
  })

  it('空名稱被拒', () => {
    expect(projectCreateSchema.safeParse({ name: '   ' }).success).toBe(false)
  })

  it('未知狀態被拒', () => {
    expect(projectCreateSchema.safeParse({ name: 'x', status: 'done' }).success).toBe(false)
  })

  it('標籤轉小寫並去重', () => {
    const r = projectCreateSchema.parse({ name: 'x', tags: ['Design', 'design', 'UI'] })
    expect(r.tags).toEqual(['design', 'ui'])
  })

  it('拒絕多餘欄位（strict，防從 body 夾帶 space_id）', () => {
    expect(
      projectCreateSchema.safeParse({ name: 'x', space_id: 'evil' }).success,
    ).toBe(false)
  })

  it('coverAssetId 必須是 uuid', () => {
    expect(projectCreateSchema.safeParse({ name: 'x', coverAssetId: 'nope' }).success).toBe(false)
  })
})

describe('projectPatchSchema', () => {
  it('允許單一欄位更新', () => {
    expect(projectPatchSchema.parse({ status: 'active' }).status).toBe('active')
  })

  it('空 patch 被拒（沒有要更新的欄位）', () => {
    expect(projectPatchSchema.safeParse({}).success).toBe(false)
  })

  it('允許把 coverAssetId 設為 null（移除封面）', () => {
    expect(projectPatchSchema.parse({ coverAssetId: null }).coverAssetId).toBeNull()
  })
})

describe('projectListQuerySchema', () => {
  it('limit 預設 60、可由字串強制轉數字', () => {
    expect(projectListQuerySchema.parse({}).limit).toBe(60)
    expect(projectListQuerySchema.parse({ limit: '10' }).limit).toBe(10)
  })

  it('limit 上限 100', () => {
    expect(projectListQuerySchema.safeParse({ limit: '999' }).success).toBe(false)
  })

  it('tag 轉小寫', () => {
    expect(projectListQuerySchema.parse({ tag: 'Design' }).tag).toBe('design')
  })
})
