/**
 * Circuit breaker。見 docs/spec/12-ai-model-routing.md §4.3。
 *
 * 純記憶體、per-instance、best-effort、重啟即清空。
 * 跳閘中的 provider 降到候選鏈隊尾而非移除 —— 仍保留為最後手段。
 * （若所有免費 provider 同時跳閘，寧可等一個慢的，也不無謂升級到付費。）
 */

export const CB_COOLDOWN_MS = 60_000
export const CB_TRIP_THRESHOLD = 2

type BreakerState = { failures: number; trippedUntil: number }

const state = new Map<string, BreakerState>()

/** 讓時間可注入，測試才能不靠真實時鐘。 */
export type Clock = () => number
const defaultClock: Clock = () => Date.now()

export function isProviderTripped(provider: string, clock: Clock = defaultClock): boolean {
  const s = state.get(provider)
  if (!s) return false
  if (s.trippedUntil > clock()) return true
  // 冷卻已過 → 視為未跳閘（但保留失敗計數直到成功或再次失敗）
  return false
}

export function markProviderFailure(provider: string, clock: Clock = defaultClock): void {
  const s = state.get(provider) ?? { failures: 0, trippedUntil: 0 }
  s.failures += 1
  if (s.failures >= CB_TRIP_THRESHOLD) {
    s.trippedUntil = clock() + CB_COOLDOWN_MS
  }
  state.set(provider, s)
}

export function markProviderSuccess(provider: string): void {
  // 成功即清空計數與跳閘
  state.delete(provider)
}

/** 測試用：清空所有狀態。 */
export function _resetBreakers(): void {
  state.clear()
}
