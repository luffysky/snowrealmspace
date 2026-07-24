import { describe, it, expect } from 'vitest'
import {
  projectRow,
  isProjectable,
  throttleMinutesFor,
  groupTitleFor,
  type ActivityEventRow,
} from './timeline-projection.js'

function row(partial: Partial<ActivityEventRow>): ActivityEventRow {
  return {
    id: 'e1',
    space_id: 's1',
    event_type: 'project.created',
    entity_type: null,
    entity_id: null,
    properties: {},
    occurred_at: '2026-07-24T00:00:00Z',
    ...partial,
  }
}

describe('isProjectable', () => {
  it('列出的事件可投影，未列出的不可', () => {
    expect(isProjectable('project.created')).toBe(true)
    expect(isProjectable('space.opened')).toBe(false)
    expect(isProjectable('widget.error')).toBe(false)
  })
})

describe('projectRow', () => {
  it('project.created 帶入名稱與 projectId', () => {
    const r = projectRow(row({ properties: { name: '海報', projectId: 'p1' } }))
    expect(r?.title).toBe('開始了「海報」')
    expect(r?.project_id).toBe('p1')
    expect(r?.visibility).toBe('private')
    expect(r?.source_event_id).toBe('e1')
  })

  it('未列出的事件回 null', () => {
    expect(projectRow(row({ event_type: 'space.opened' }))).toBeNull()
  })

  it('asset.uploaded 用 entity_id 當封面', () => {
    const r = projectRow(row({ event_type: 'asset.uploaded', entity_id: 'a1' }))
    expect(r?.cover_asset_id).toBe('a1')
  })

  it('surprise 只投影 rare 以上', () => {
    expect(projectRow(row({ event_type: 'surprise.unlocked', properties: { rarity: 'common' } }))).toBeNull()
    expect(
      projectRow(row({ event_type: 'surprise.unlocked', properties: { rarity: 'legendary' } })),
    ).not.toBeNull()
  })
})

describe('節流', () => {
  it('asset.uploaded 有 60 分鐘節流窗，group 標題隨數量變化', () => {
    expect(throttleMinutesFor('asset.uploaded')).toBe(60)
    expect(groupTitleFor('asset.uploaded', 1)).toBe('新增了作品')
    expect(groupTitleFor('asset.uploaded', 5)).toBe('新增了 5 個作品')
  })

  it('沒有節流的事件回 null', () => {
    expect(throttleMinutesFor('project.created')).toBeNull()
  })
})
