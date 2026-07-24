import { describe, it, expect } from 'vitest'
import { timelineListQuerySchema, timelinePatchSchema } from './timeline.js'

describe('timelineListQuerySchema', () => {
  it('view 預設 chronological', () => {
    expect(timelineListQuerySchema.parse({}).view).toBe('chronological')
  })
  it('接受三種檢視', () => {
    expect(timelineListQuerySchema.parse({ view: 'project' }).view).toBe('project')
    expect(timelineListQuerySchema.parse({ view: 'on_this_day' }).view).toBe('on_this_day')
  })
  it('未知檢視被拒', () => {
    expect(timelineListQuerySchema.safeParse({ view: 'weekly' }).success).toBe(false)
  })
  it('limit 上限 200', () => {
    expect(timelineListQuerySchema.safeParse({ limit: '999' }).success).toBe(false)
  })
})

describe('timelinePatchSchema', () => {
  it('空 patch 被拒', () => {
    expect(timelinePatchSchema.safeParse({}).success).toBe(false)
  })
  it('可改可見性', () => {
    expect(timelinePatchSchema.parse({ visibility: 'hidden' }).visibility).toBe('hidden')
  })
  it('未知可見性被拒', () => {
    expect(timelinePatchSchema.safeParse({ visibility: 'public' }).success).toBe(false)
  })
})
