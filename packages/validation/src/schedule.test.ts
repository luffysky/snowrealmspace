import { describe, it, expect } from 'vitest'
import { localHour, localDate, slotForHour, seededIndex } from './schedule.js'
import type { ScheduleSpec } from './backgrounds.js'

const id = (n: number) => `${n}`.repeat(8) + '-1111-4111-8111-111111111111'

describe('localHour', () => {
  it('依時區換算，不是用 UTC', () => {
    // 2026-07-23T00:00:00Z = 台北時間 08:00
    const utcMidnight = new Date('2026-07-23T00:00:00Z')
    expect(localHour(utcMidnight, 'Asia/Taipei')).toBe(8)
    expect(localHour(utcMidnight, 'UTC')).toBe(0)
  })

  it('跨日的時區換算正確', () => {
    // 2026-07-23T20:00:00Z = 台北隔天 04:00
    const evening = new Date('2026-07-23T20:00:00Z')
    expect(localHour(evening, 'Asia/Taipei')).toBe(4)
  })

  it('午夜回傳 0 而非 24', () => {
    // 2026-07-22T16:00:00Z = 台北 00:00
    expect(localHour(new Date('2026-07-22T16:00:00Z'), 'Asia/Taipei')).toBe(0)
  })

  it('無效時區退回 UTC 而不是拋錯', () => {
    const date = new Date('2026-07-23T05:00:00Z')
    expect(localHour(date, 'Not/AZone')).toBe(5)
  })
})

describe('localDate', () => {
  it('依時區判斷是哪一天', () => {
    // 台北時間已是 23 日，UTC 還在 22 日
    const date = new Date('2026-07-22T17:00:00Z')
    expect(localDate(date, 'Asia/Taipei')).toBe('2026-07-23')
    expect(localDate(date, 'UTC')).toBe('2026-07-22')
  })

  it('格式為 YYYY-MM-DD', () => {
    expect(localDate(new Date('2026-01-05T12:00:00Z'), 'UTC')).toBe('2026-01-05')
  })
})

describe('slotForHour', () => {
  const schedule: ScheduleSpec = {
    slots: [
      { startHour: 6, endHour: 11, backgroundItemId: id(1) },
      { startHour: 11, endHour: 17, backgroundItemId: id(2) },
      { startHour: 17, endHour: 21, backgroundItemId: id(3) },
      { startHour: 21, endHour: 6, backgroundItemId: id(4) },
    ],
  }

  it.each([
    [6, 1],
    [10, 1],
    [11, 2],
    [16, 2],
    [17, 3],
    [20, 3],
  ])('%i 點落在第 %i 個時段', (hour, expected) => {
    expect(slotForHour(schedule, hour)?.backgroundItemId).toBe(id(expected))
  })

  /**
   * 這是最容易寫錯的一段。
   * 用 `hour >= start && hour < end` 判斷 21–6，永遠為 false，
   * 夜晚背景會完全不出現而且沒有錯誤訊息。
   */
  it.each([21, 23, 0, 3, 5])('跨午夜時段涵蓋 %i 點', (hour) => {
    expect(slotForHour(schedule, hour)?.backgroundItemId).toBe(id(4))
  })

  it('涵蓋一整天的每個小時，沒有空隙', () => {
    for (let hour = 0; hour < 24; hour++) {
      expect(slotForHour(schedule, hour), `${hour} 點沒有對應時段`).not.toBeNull()
    }
  })

  it('沒有符合的時段回 null', () => {
    const partial: ScheduleSpec = {
      slots: [{ startHour: 9, endHour: 17, backgroundItemId: id(1) }],
    }
    expect(slotForHour(partial, 20)).toBeNull()
  })

  it('空排程回 null', () => {
    expect(slotForHour({ slots: [] }, 12)).toBeNull()
  })

  it('endHour 為 24 時涵蓋到午夜前', () => {
    const s: ScheduleSpec = {
      slots: [{ startHour: 18, endHour: 24, backgroundItemId: id(1) }],
    }
    expect(slotForHour(s, 23)?.backgroundItemId).toBe(id(1))
    expect(slotForHour(s, 0)).toBeNull()
  })
})

describe('seededIndex', () => {
  it('相同種子必得相同結果', () => {
    expect(seededIndex('playlist-a:2026-07-23', 5)).toBe(seededIndex('playlist-a:2026-07-23', 5))
  })

  it('不同日期會得到不同結果（大多數情況）', () => {
    const days = ['2026-07-21', '2026-07-22', '2026-07-23', '2026-07-24', '2026-07-25']
    const picks = days.map((d) => seededIndex(`p:${d}`, 5))
    // 五天不該全部落在同一張
    expect(new Set(picks).size).toBeGreaterThan(1)
  })

  it('結果一定在範圍內', () => {
    for (let n = 1; n <= 20; n++) {
      for (const seed of ['a', 'bb', 'ccc-2026-07-23', '中文種子']) {
        const index = seededIndex(seed, n)
        expect(index).toBeGreaterThanOrEqual(0)
        expect(index).toBeLessThan(n)
      }
    }
  })

  it('長度為 0 時回 0 而不是 NaN', () => {
    expect(seededIndex('x', 0)).toBe(0)
  })
})
