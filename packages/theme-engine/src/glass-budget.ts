/**
 * 毛玻璃（backdrop-filter）數量上限。實作 05-theme-tokens.md §2 的效能規則。
 *
 * backdrop-filter 每個元素都要對它後方的畫面做一次模糊取樣，
 * 是真實的 GPU 成本。同一畫面太多個會在中低階裝置上掉幀 ——
 * 尤其是背景還在播放影片或漸層時。
 *
 * 規則：桌機同時最多 12 個毛玻璃元素，行動裝置 6 個。
 * 超過的降級為 solid（不透明背景、無模糊），視覺上仍然是卡片，
 * 只是少了透背景的效果。
 */

export const GLASS_BUDGET = {
  desktop: 12,
  tablet: 12,
  mobile: 6,
} as const

export type GlassBreakpoint = keyof typeof GLASS_BUDGET

export function glassBudgetFor(breakpoint: string): number {
  return GLASS_BUDGET[breakpoint as GlassBreakpoint] ?? GLASS_BUDGET.mobile
}

/**
 * 決定每個 widget 是否套用毛玻璃。
 *
 * `priority` 是每個元素的優先序（數字小的優先保留毛玻璃）——
 * 用來讓「在視窗內的 widget」優先於「捲動到看不見的」。
 * 傳 index 當 priority 就是「依 DOM 順序」的預設行為。
 *
 * 回傳與輸入等長的布林陣列：true = 毛玻璃，false = 降級為 solid。
 *
 * 為什麼抽成純函式：這是效能規則的核心判斷，而效能問題在真實環境
 * 幾乎不會被清楚回報（「有時候有點卡」無法重現）。只能靠測試守。
 */
export function assignGlass(priorities: readonly number[], budget: number): boolean[] {
  if (budget <= 0) return priorities.map(() => false)
  if (priorities.length <= budget) return priorities.map(() => true)

  // 取優先序最小的 budget 個給毛玻璃，其餘 solid。
  // 用索引排序後取前 budget 名，再映射回原順序。
  const ranked = priorities
    .map((priority, index) => ({ priority, index }))
    .sort((a, b) => a.priority - b.priority || a.index - b.index)

  const glassIndices = new Set(ranked.slice(0, budget).map((r) => r.index))
  return priorities.map((_, index) => glassIndices.has(index))
}
