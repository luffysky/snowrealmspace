import { describe, it, expect } from 'vitest'
import {
  needsClientRotation,
  intervalMsFor,
  perLoginIndex,
  nextIndex,
  validateSlots,
  hoursIn,
  uncoveredHours,
  type Slot,
} from './playback.js'

describe('needsClientRotation', () => {
  it.each(['sequential', 'hourly', 'per_login'])('%s 需要前端輪播', (mode) => {
    expect(needsClientRotation(mode)).toBe(true)
  })

  it.each(['single', 'daily', 'random', 'time_of_day'])('%s 由伺服器決定，不輪播', (mode) => {
    expect(needsClientRotation(mode)).toBe(false)
  })
})

describe('intervalMsFor', () => {
  it('hourly 固定一小時', () => {
    expect(intervalMsFor('hourly', 999)).toBe(60 * 60 * 1000)
  })

  it('sequential 用設定的秒數', () => {
    expect(intervalMsFor('sequential', 30)).toBe(30_000)
  })

  it('sequential 太短的秒數被拉到 5 秒下限', () => {
    expect(intervalMsFor('sequential', 1)).toBe(5000)
  })

  it('sequential 過長的秒數被限制在 24 小時', () => {
    expect(intervalMsFor('sequential', 999_999)).toBe(24 * 60 * 60 * 1000)
  })

  it('per_login 回 null —— 它只在載入時決定一次，不定時換', () => {
    expect(intervalMsFor('per_login', 30)).toBeNull()
  })

  it('single 回 null', () => {
    expect(intervalMsFor('single', 30)).toBeNull()
  })
})

describe('perLoginIndex', () => {
  it('依載入次數輪替', () => {
    expect(perLoginIndex(0, 3)).toBe(0)
    expect(perLoginIndex(1, 3)).toBe(1)
    expect(perLoginIndex(2, 3)).toBe(2)
    expect(perLoginIndex(3, 3)).toBe(0)
  })

  it('空清單回 0 而不是 NaN', () => {
    expect(perLoginIndex(5, 0)).toBe(0)
  })
})

describe('nextIndex', () => {
  it('到底回到 0', () => {
    expect(nextIndex(2, 3)).toBe(0)
  })

  it('空清單回 0', () => {
    expect(nextIndex(0, 0)).toBe(0)
  })
})

describe('hoursIn', () => {
  it('一般時段', () => {
    expect(hoursIn({ startHour: 9, endHour: 12, backgroundItemId: 'a' })).toEqual([9, 10, 11])
  })

  it('跨午夜會繞回去', () => {
    expect(hoursIn({ startHour: 22, endHour: 3, backgroundItemId: 'a' })).toEqual([
      22, 23, 0, 1, 2,
    ])
  })

  it('endHour 24 等同午夜', () => {
    expect(hoursIn({ startHour: 22, endHour: 24, backgroundItemId: 'a' })).toEqual([22, 23])
  })
})

describe('validateSlots', () => {
  it('空清單合法', () => {
    expect(validateSlots([]).ok).toBe(true)
  })

  it('不重疊的時段合法', () => {
    const slots: Slot[] = [
      { startHour: 6, endHour: 12, backgroundItemId: 'morning' },
      { startHour: 12, endHour: 18, backgroundItemId: 'afternoon' },
      { startHour: 18, endHour: 6, backgroundItemId: 'night' },
    ]
    expect(validateSlots(slots).ok).toBe(true)
  })

  it('重疊要被擋下 —— 否則哪個生效取決於陣列順序，是隱形的隨機行為', () => {
    const slots: Slot[] = [
      { startHour: 6, endHour: 14, backgroundItemId: 'a' },
      { startHour: 12, endHour: 18, backgroundItemId: 'b' },
    ]
    const result = validateSlots(slots)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain('12:00')
  })

  it('跨午夜的重疊也要抓到', () => {
    const slots: Slot[] = [
      { startHour: 22, endHour: 6, backgroundItemId: 'a' },
      { startHour: 4, endHour: 8, backgroundItemId: 'b' },
    ]
    expect(validateSlots(slots).ok).toBe(false)
  })

  it('起訖相同不合法', () => {
    expect(validateSlots([{ startHour: 9, endHour: 9, backgroundItemId: 'a' }]).ok).toBe(false)
  })

  it('超出範圍的小時不合法', () => {
    expect(validateSlots([{ startHour: 25, endHour: 26, backgroundItemId: 'a' }]).ok).toBe(false)
  })

  it('非整數不合法', () => {
    expect(validateSlots([{ startHour: 9.5, endHour: 12, backgroundItemId: 'a' }]).ok).toBe(false)
  })
})

describe('uncoveredHours', () => {
  it('列出沒被涵蓋的小時 —— UI 要能明說「這些時間沒設定」', () => {
    const slots: Slot[] = [{ startHour: 6, endHour: 18, backgroundItemId: 'day' }]
    expect(uncoveredHours(slots)).toEqual([0, 1, 2, 3, 4, 5, 18, 19, 20, 21, 22, 23])
  })

  it('全天涵蓋時為空', () => {
    const slots: Slot[] = [{ startHour: 0, endHour: 24, backgroundItemId: 'all' }]
    expect(uncoveredHours(slots)).toEqual([])
  })

  it('沒有時段時全部未涵蓋', () => {
    expect(uncoveredHours([])).toHaveLength(24)
  })
})
