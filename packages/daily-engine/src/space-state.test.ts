import { describe, it, expect } from 'vitest'
import { deriveSpaceState, STATE_TAGS, type StateEvent } from './space-state.js'

const TZ = 'Asia/Taipei'
const NOW = new Date('2026-07-27T12:00:00+08:00') // 台北時間 2026-07-27 12:00

/** 產生某當地日某時的 space.opened 事件。 */
function opened(date: string, hour = 12): StateEvent {
  const hh = String(hour).padStart(2, '0')
  return { event_type: 'space.opened', occurred_at: `${date}T${hh}:00:00+08:00` }
}

describe('deriveSpaceState', () => {
  it('沒有事件 → low、無狀態標籤', () => {
    const s = deriveSpaceState([], TZ, NOW)
    expect(s.recentActivityLevel).toBe('low')
    expect(s.tags).toEqual([])
  })

  it('近 7 天出沒 ≥5 天 → high', () => {
    const events = ['2026-07-27', '2026-07-26', '2026-07-25', '2026-07-24', '2026-07-23'].map((d) =>
      opened(d),
    )
    expect(deriveSpaceState(events, TZ, NOW).recentActivityLevel).toBe('high')
  })

  it('久違回歸：離開超過 7 天又回來 → st_returning', () => {
    const events = [opened('2026-07-27'), opened('2026-07-15')] // 相隔 12 天
    const s = deriveSpaceState(events, TZ, NOW)
    expect(s.tags).toContain(STATE_TAGS.returning)
  })

  it('反例：昨天才來過，今天不是回歸', () => {
    const events = [opened('2026-07-27'), opened('2026-07-26')]
    const s = deriveSpaceState(events, TZ, NOW)
    expect(s.tags).not.toContain(STATE_TAGS.returning)
  })

  it('連續 3 天 → st_streak', () => {
    const events = ['2026-07-27', '2026-07-26', '2026-07-25'].map((d) => opened(d))
    expect(deriveSpaceState(events, TZ, NOW).tags).toContain(STATE_TAGS.streak)
  })

  it('反例：連續只有 2 天，不算 streak', () => {
    const events = ['2026-07-27', '2026-07-26'].map((d) => opened(d))
    expect(deriveSpaceState(events, TZ, NOW).tags).not.toContain(STATE_TAGS.streak)
  })

  it('近 3 天有上傳 → st_creating', () => {
    const events: StateEvent[] = [
      { event_type: 'asset.uploaded', occurred_at: '2026-07-26T10:00:00+08:00' },
    ]
    expect(deriveSpaceState(events, TZ, NOW).tags).toContain(STATE_TAGS.creating)
  })

  it('反例：上傳是 10 天前，不算 creating', () => {
    const events: StateEvent[] = [
      { event_type: 'asset.uploaded', occurred_at: '2026-07-17T10:00:00+08:00' },
    ]
    expect(deriveSpaceState(events, TZ, NOW).tags).not.toContain(STATE_TAGS.creating)
  })

  it('近 3 天動主題/背景 → st_decorating', () => {
    const events: StateEvent[] = [
      { event_type: 'theme.applied', occurred_at: '2026-07-27T09:00:00+08:00' },
    ]
    expect(deriveSpaceState(events, TZ, NOW).tags).toContain(STATE_TAGS.decorating)
  })

  it('多次深夜開啟 → st_nightowl', () => {
    const events = [opened('2026-07-27', 2), opened('2026-07-26', 1), opened('2026-07-25', 3)]
    expect(deriveSpaceState(events, TZ, NOW).tags).toContain(STATE_TAGS.nightOwl)
  })

  it('summary 帶出活躍度與標籤（狀態不靜默）', () => {
    const events = ['2026-07-27', '2026-07-26', '2026-07-25'].map((d) => opened(d))
    const s = deriveSpaceState(events, TZ, NOW)
    expect(s.summary).toContain('活躍度')
    expect(s.summary).toContain('連續造訪')
  })
})
