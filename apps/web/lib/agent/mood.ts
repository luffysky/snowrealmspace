/**
 * AI 夥伴的情緒訊號（2D 表情用）。
 *
 * 對話端（AgentChat）在收到 LLM 吐的情緒時 `emitAgentMood(...)`，
 * 漂浮小幫手 / 頁面頭像 `onAgentMood(...)` 收到就換表情 emoji。
 * 純 window CustomEvent，SSR 時全為 no-op。取代原本綁 VRM 的 bus。
 */

export type AgentMood =
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

/** 情緒 → 2D 表情 emoji。 */
export const MOOD_EMOJI: Record<AgentMood, string> = {
  happy: '😊',
  surprised: '😮',
  relaxed: '😌',
  neutral: '🙂',
  wink: '😉',
  excited: '🤩',
  thinking: '🤔',
  sad: '😢',
  shy: '😳',
  angry: '😠',
}

const EVENT = 'sr-agent-mood'

export function emitAgentMood(mood: AgentMood): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<AgentMood>(EVENT, { detail: mood }))
}

export function onAgentMood(cb: (mood: AgentMood) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = (e: Event) => cb((e as CustomEvent<AgentMood>).detail)
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}
