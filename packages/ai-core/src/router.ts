import type { UsageCandidate } from './candidates.js'
import { orderCandidates, filterAffordable, escalateTarget, providerOf } from './candidates.js'
import { markProviderFailure, markProviderSuccess, type Clock } from './circuit-breaker.js'
import { isQuotaOrTransientError, looksLowConfidence, AllCandidatesFailedError } from './errors.js'

/**
 * 候選鏈編排（§4.5 步驟 3–7）。純演算法：把「怎麼呼叫一個候選」抽成注入的
 * attempt 函式，讓 fallback / 升級 / 斷路器 / 缺金鑰跳過的邏輯可完整單元測試，
 * 不需真金鑰或 HTTP。實際的 completeForUsage 用真的 attempt（callAI + keys）包這個。
 */

export type AttemptResult = {
  text: string
  /** 供結構化輸出用途：schema 驗證失敗視同低信心（§4.4）。 */
  schemaValid?: boolean
  toolCalls?: unknown[]
  raw?: unknown
}

export type CandidateOutcome =
  | { ok: true; result: AttemptResult; candidate: UsageCandidate }
  | { ok: false; error: unknown; candidate: UsageCandidate }

export type RunDeps = {
  /** 回傳該候選的 api key；null = 缺金鑰，跳過（不計 attempt）。 */
  hasKey: (candidate: UsageCandidate) => boolean
  /** 實際呼叫模型。丟錯代表失敗，交給 isQuotaOrTransientError 判斷是否換模型。 */
  attempt: (candidate: UsageCandidate) => Promise<AttemptResult>
  isFree: (model: string) => boolean
  clock?: Clock
}

export type RunOptions = {
  forceEscalate?: boolean
  paidBudgetExhausted?: boolean
  /** 有 responseSchema 時，schemaValid=false 視同低信心觸發升級。 */
  hasSchema?: boolean
  minChars?: number
}

export type RunResult = {
  result: AttemptResult
  candidate: UsageCandidate
  attempts: number
  fellBack: boolean
  escalated: boolean
  degraded: boolean
}

function isLowConfidence(r: AttemptResult, hasSchema: boolean, minChars?: number): boolean {
  if (hasSchema && r.schemaValid === false) return true
  return looksLowConfidence(r.text, minChars)
}

/**
 * 依序嘗試候選，回傳第一個成功且非低信心的結果；免費模型低信心時升級一次。
 * 缺金鑰的候選跳過（不計 attempt，§11「缺金鑰跳過」）。
 * 值得換模型的錯誤 → markProviderFailure + 換下一個；真錯誤 → 直接拋。
 */
export async function runCandidateChain(
  chain: readonly UsageCandidate[],
  deps: RunDeps,
  opts: RunOptions = {},
): Promise<RunResult> {
  const affordable = filterAffordable(chain, deps.isFree, opts.paidBudgetExhausted ?? false)
  const degraded = (opts.paidBudgetExhausted ?? false) && affordable.length < chain.length
  const orderOpts: { forceEscalate?: boolean; clock?: Clock } = {}
  if (opts.forceEscalate !== undefined) orderOpts.forceEscalate = opts.forceEscalate
  if (deps.clock !== undefined) orderOpts.clock = deps.clock
  const ordered = orderCandidates(affordable, orderOpts)

  let attempts = 0
  let fellBack = false
  let lastError: unknown = null
  let firstNonEmpty: { result: AttemptResult; candidate: UsageCandidate } | null = null

  for (let i = 0; i < ordered.length; i++) {
    const candidate = ordered[i]!
    if (!deps.hasKey(candidate)) continue // 缺金鑰：跳過，不計 attempt

    attempts += 1
    if (attempts > 1) fellBack = true

    let result: AttemptResult
    try {
      result = await deps.attempt(candidate)
    } catch (err) {
      lastError = err
      if (isQuotaOrTransientError(err)) {
        markProviderFailure(providerOf(candidate), deps.clock)
        continue // 換下一個候選
      }
      throw err // 真錯誤：直接拋，不換模型（§4.2）
    }

    markProviderSuccess(providerOf(candidate))
    if (result.text && !firstNonEmpty) firstNonEmpty = { result, candidate }

    const low = isLowConfidence(result, opts.hasSchema ?? false, opts.minChars)
    if (!low) {
      return { result, candidate, attempts, fellBack, escalated: false, degraded }
    }

    // 低信心 → 嘗試升級一次（§4.4）
    if (candidate.role !== 'escalate') {
      const target = escalateTarget(chain, candidate)
      if (target && deps.hasKey(target)) {
        attempts += 1
        try {
          const escResult = await deps.attempt(target)
          markProviderSuccess(providerOf(target))
          const stillLow = isLowConfidence(escResult, opts.hasSchema ?? false, opts.minChars)
          // 升級仍低信心且原輸出非空 → 保留原輸出（§4.4 規則 4）
          if (stillLow && result.text) {
            return { result, candidate, attempts, fellBack: true, escalated: true, degraded }
          }
          return {
            result: escResult,
            candidate: target,
            attempts,
            fellBack: true,
            escalated: true,
            degraded,
          }
        } catch (err) {
          // 升級失敗不致命，沿用原輸出（§4.4 規則 5）
          lastError = err
          if (result.text) {
            return { result, candidate, attempts, fellBack: true, escalated: true, degraded }
          }
        }
      }
    }
    // 沒有可升級對象、或升級也沒救 → 繼續試下一個候選
  }

  // 候選全滅，但若途中有非空輸出就用它（勝過拋錯）
  if (firstNonEmpty) {
    return {
      result: firstNonEmpty.result,
      candidate: firstNonEmpty.candidate,
      attempts,
      fellBack,
      escalated: false,
      degraded,
    }
  }
  throw new AllCandidatesFailedError(
    `所有候選失敗（${attempts} 次嘗試）：${String((lastError as Error)?.message ?? lastError)}`,
    attempts,
  )
}
