import { describe, it, expect } from 'vitest'
import { GLASS_BUDGET, glassBudgetFor, assignGlass } from './glass-budget.js'

describe('glassBudgetFor', () => {
  it('桌機與平板 12、行動 6', () => {
    expect(glassBudgetFor('desktop')).toBe(12)
    expect(glassBudgetFor('tablet')).toBe(12)
    expect(glassBudgetFor('mobile')).toBe(6)
  })

  it('未知斷點退回最保守的行動上限', () => {
    expect(glassBudgetFor('watch')).toBe(GLASS_BUDGET.mobile)
  })
})

describe('assignGlass', () => {
  it('數量在預算內時全部套毛玻璃', () => {
    expect(assignGlass([0, 1, 2], 12)).toEqual([true, true, true])
  })

  it('剛好等於預算時全部套', () => {
    expect(assignGlass([0, 1, 2, 3, 4, 5], 6).every(Boolean)).toBe(true)
  })

  it('超過預算時只有前 N 個套，其餘降級', () => {
    // 8 個、預算 6：依 priority（此處等同 index）取前 6
    const result = assignGlass([0, 1, 2, 3, 4, 5, 6, 7], 6)
    expect(result.filter(Boolean).length).toBe(6)
    expect(result).toEqual([true, true, true, true, true, true, false, false])
  })

  it('20 個 widget、桌機預算 12 → 剛好 12 個毛玻璃（驗收情境）', () => {
    const priorities = Array.from({ length: 20 }, (_, i) => i)
    const result = assignGlass(priorities, 12)
    expect(result.filter(Boolean).length).toBe(12)
  })

  it('priority 決定誰保留 —— 視窗內的（數字小）優先於捲動看不見的', () => {
    // 第 2、0、1 個在視窗內（priority 0,1,2），其餘在視窗外（priority 大）
    const priorities = [1, 2, 0, 99, 98, 97]
    const result = assignGlass(priorities, 3)
    // priority 最小的三個是 index 2(0)、0(1)、1(2)
    expect(result).toEqual([true, true, true, false, false, false])
  })

  it('priority 相同時用 index 當 tie-break，結果穩定', () => {
    const result = assignGlass([5, 5, 5, 5], 2)
    expect(result).toEqual([true, true, false, false])
  })

  it('預算為 0 時全部降級', () => {
    expect(assignGlass([0, 1, 2], 0)).toEqual([false, false, false])
  })

  it('空清單回空', () => {
    expect(assignGlass([], 12)).toEqual([])
  })
})
