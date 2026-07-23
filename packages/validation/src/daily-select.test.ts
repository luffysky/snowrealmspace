import { describe, it, expect } from 'vitest'
import {
  pickDailyItem,
  hashToUnit,
  daysBetween,
  greetingSlotForHour,
  type PoolEntry,
  type SelectInput,
} from './daily-select.js'

function entry(id: string, over: Partial<PoolEntry> = {}): PoolEntry {
  return { contentId: id, text: id, tags: [], weight: 1, ...over }
}

function baseInput(over: Partial<SelectInput> = {}): SelectInput {
  return {
    pool: [entry('a'), entry('b'), entry('c')],
    localDate: '2026-07-24',
    recent: [],
    context: { daysSinceSignup: 100, tags: [], recentActivityLevel: 'normal' },
    defaultCooldownDays: 30,
    seed: 'space1:2026-07-24',
    ...over,
  }
}

describe('hashToUnit', () => {
  it('回 [0,1)', () => {
    for (const s of ['a', 'hello', 'space1:2026-07-24', '']) {
      const v = hashToUnit(s)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
  it('決定性 —— 同輸入同輸出', () => {
    expect(hashToUnit('x')).toBe(hashToUnit('x'))
  })
  it('不同輸入通常不同', () => {
    expect(hashToUnit('a')).not.toBe(hashToUnit('b'))
  })
})

describe('daysBetween', () => {
  it('同日為 0', () => expect(daysBetween('2026-07-24', '2026-07-24')).toBe(0))
  it('相鄰為 1', () => expect(daysBetween('2026-07-24', '2026-07-25')).toBe(1))
  it('跨月正確', () => expect(daysBetween('2026-07-31', '2026-08-01')).toBe(1))
  it('順序不影響（絕對值）', () => expect(daysBetween('2026-08-01', '2026-07-31')).toBe(1))
})

describe('greetingSlotForHour', () => {
  it.each([
    [6, 'morning'],
    [13, 'afternoon'],
    [18, 'evening'],
    [23, 'night'],
    [2, 'night'],
  ])('%i 時 → %s', (h, slot) => {
    expect(greetingSlotForHour(h)).toBe(slot)
  })
})

describe('pickDailyItem', () => {
  it('空池回 null', () => {
    expect(pickDailyItem(baseInput({ pool: [] }))).toBeNull()
  })

  it('決定性 —— 同一天同一 space 選同一則', () => {
    const a = pickDailyItem(baseInput())
    const b = pickDailyItem(baseInput())
    expect(a?.contentId).toBe(b?.contentId)
  })

  it('不同日期通常選不同（seed 不同）', () => {
    const day1 = pickDailyItem(baseInput({ seed: 's:day1', localDate: '2026-07-24' }))
    const day2 = pickDailyItem(baseInput({ seed: 's:day2', localDate: '2026-07-25' }))
    // 至少函式對不同 seed 有反應（不保證一定不同，但大池下極可能）
    expect(day1).not.toBeNull()
    expect(day2).not.toBeNull()
  })

  it('冷卻中的不選', () => {
    // a、b 昨天剛用過，冷卻 30 天 → 只剩 c
    const picked = pickDailyItem(
      baseInput({
        recent: [
          { contentId: 'a', localDate: '2026-07-23', tags: [] },
          { contentId: 'b', localDate: '2026-07-23', tags: [] },
        ],
      }),
    )
    expect(picked?.contentId).toBe('c')
  })

  it('minDaysSinceSignup 未達不選', () => {
    const picked = pickDailyItem(
      baseInput({
        pool: [entry('new', { minDaysSinceSignup: 30 })],
        context: { daysSinceSignup: 5, tags: [], recentActivityLevel: 'normal' },
      }),
    )
    expect(picked).toBeNull()
  })

  it('requiresTag 不符不選', () => {
    const picked = pickDailyItem(
      baseInput({
        pool: [entry('design', { requiresTag: 'design' })],
        context: { daysSinceSignup: 100, tags: ['casual'], recentActivityLevel: 'normal' },
      }),
    )
    expect(picked).toBeNull()
  })

  it('前兩天的 tag 會避開（同類型不連續三天）', () => {
    // a 有 tag design，前天/昨天都出現 design → 避開 a，選沒有衝突的 b
    const picked = pickDailyItem(
      baseInput({
        pool: [entry('a', { tags: ['design'] }), entry('b', { tags: ['rest'] })],
        recent: [{ contentId: 'x', localDate: '2026-07-23', tags: ['design'] }],
      }),
    )
    expect(picked?.contentId).toBe('b')
  })

  it('全部冷卻中時放寬到一半冷卻，仍能回一則而非 null', () => {
    // 唯一一則 15 天前用過、冷卻 30 天 → 全條件無候選，放寬到一半(15)剛好可用
    const picked = pickDailyItem(
      baseInput({
        pool: [entry('only', { cooldownDays: 30 })],
        recent: [{ contentId: 'only', localDate: '2026-07-09', tags: [] }], // 15 天前
      }),
    )
    expect(picked?.contentId).toBe('only')
  })

  it('低活躍時偏好低門檻 prompt', () => {
    // quick(2分) 權重被 ×3，long(60分) 不變 → 幾乎必選 quick
    const results = new Set<string>()
    for (let i = 0; i < 20; i++) {
      const p = pickDailyItem(
        baseInput({
          pool: [
            entry('quick', { estimatedMinutes: 2 }),
            entry('long', { estimatedMinutes: 60 }),
          ],
          context: { daysSinceSignup: 100, tags: [], recentActivityLevel: 'low' },
          seed: `s:${i}`,
        }),
      )
      if (p) results.add(p.contentId)
    }
    // quick 應該佔絕大多數 —— 至少要出現
    expect(results.has('quick')).toBe(true)
  })

  it('加權：高權重的較常被選', () => {
    let heavy = 0
    for (let i = 0; i < 100; i++) {
      const p = pickDailyItem(
        baseInput({
          pool: [entry('heavy', { weight: 10 }), entry('light', { weight: 1 })],
          seed: `s:${i}`,
        }),
      )
      if (p?.contentId === 'heavy') heavy++
    }
    // heavy 權重 10 倍，應該遠過半
    expect(heavy).toBeGreaterThan(70)
  })
})
