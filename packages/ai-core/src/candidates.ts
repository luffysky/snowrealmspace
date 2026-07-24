import { providerFromModel } from './providers.js'
import { isProviderTripped, type Clock } from './circuit-breaker.js'

/**
 * 候選鏈的排序與升級邏輯。見 docs/spec/12-ai-model-routing.md §4。
 * 純函式（circuit breaker 狀態經參數注入或全域讀取）—— 可完整單元測試。
 */

export type CandidateRole = 'primary' | 'fallback' | 'escalate'

export type UsageCandidate = {
  /** provider:model 形式，例如 'groq:llama-3.3-70b'。 */
  model: string
  role: CandidateRole
}

export function providerOf(candidate: UsageCandidate): string {
  return providerFromModel(candidate.model)
}

/**
 * 排序候選鏈（§4.5 步驟 3–4）：
 *  1. forceEscalate → 把 escalate 候選提到最前面（使用者主動要求深入）
 *  2. 跳閘中的 provider 降到隊尾（而非移除，§4.3）—— 穩定排序保留原相對順序
 */
export function orderCandidates(
  chain: readonly UsageCandidate[],
  opts: { forceEscalate?: boolean; clock?: Clock } = {},
): UsageCandidate[] {
  let list = [...chain]

  if (opts.forceEscalate) {
    const esc = list.filter((c) => c.role === 'escalate')
    const rest = list.filter((c) => c.role !== 'escalate')
    list = [...esc, ...rest]
  }

  // 穩定分割：未跳閘的維持原序在前，跳閘的維持原序在後
  const healthy: UsageCandidate[] = []
  const tripped: UsageCandidate[] = []
  for (const c of list) {
    if (isProviderTripped(providerOf(c), opts.clock)) tripped.push(c)
    else healthy.push(c)
  }
  return [...healthy, ...tripped]
}

/**
 * 過濾付費候選（§4.5 步驟 1）：付費預算用盡時，degraded 模式只留免費候選。
 * 需要知道哪些 model 是付費 —— 由呼叫端提供判定函式（讀 ai_models.is_free）。
 */
export function filterAffordable(
  chain: readonly UsageCandidate[],
  isFree: (model: string) => boolean,
  paidBudgetExhausted: boolean,
): UsageCandidate[] {
  if (!paidBudgetExhausted) return [...chain]
  return chain.filter((c) => isFree(c.model))
}

/**
 * 選升級目標（§4.4）：優先 role==='escalate' 的候選；沒有就用鏈尾。
 * 回傳 null 表示無可升級對象（例如整條鏈只有一個候選且已是它）。
 */
export function escalateTarget(
  chain: readonly UsageCandidate[],
  current: UsageCandidate,
): UsageCandidate | null {
  // 當前已是 escalate → 不再升級（§4.4 規則 1）
  if (current.role === 'escalate') return null
  const esc = chain.find((c) => c.role === 'escalate')
  if (esc && esc.model !== current.model) return esc
  const tail = chain[chain.length - 1]
  if (tail && tail.model !== current.model) return tail
  return null
}
