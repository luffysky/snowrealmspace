/**
 * VRM 角色的控制訊號匯流排（window CustomEvent）。
 *
 * 角色 widget 掛在全站（layout），Agent 對話在單一頁 —— 兩者不直接相連。
 * 對話端 `emitVrm(...)` 發訊號、widget 端 `onVrm(...)` 收，達成「AI 回應 → 角色反應」
 * 而不需 props 穿透或全域 store。沒有 window（SSR）時全部是 no-op。
 */

export type VrmMood =
  | 'happy'
  | 'surprised'
  | 'relaxed'
  | 'neutral'
  | 'wink'
  | 'excited'
  | 'thinking'
  | 'sad'
  | 'shy'
  | 'angry'

export type VrmSignal =
  | { type: 'mood'; mood: VrmMood }
  | { type: 'animation'; name: string }
  | { type: 'speak'; text: string }
  | { type: 'stop' }

const EVENT = 'sr-vrm-signal'

export function emitVrm(signal: VrmSignal): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<VrmSignal>(EVENT, { detail: signal }))
}

export function onVrm(cb: (signal: VrmSignal) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = (e: Event) => cb((e as CustomEvent<VrmSignal>).detail)
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}
