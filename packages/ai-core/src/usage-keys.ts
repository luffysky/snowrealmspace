/**
 * AI 用途 key。見 docs/spec/12-ai-model-routing.md §2。
 *
 * 每個 usage key 是一個「AI 任務類型」，各有獨立候選鏈與預設 tier。
 * 呼叫端只知道用途，不知道模型 —— 這是 ADR-023 免費優先能成立的前提。
 */
export type AiUsageKey =
  // 對話
  | 'agent_chat'
  | 'agent_chat_deep'
  | 'agent_proactive'
  // 設計
  | 'design_vision_light'
  | 'design_vision_deep'
  | 'design_compare'
  // 主題
  | 'theme_from_mood'
  | 'theme_name'
  | 'font_pairing'
  // 每日內容
  | 'daily_card'
  | 'daily_prompt'
  | 'greeting'
  // 記憶與洞察
  | 'memory_proposal'
  | 'insight_phrasing'
  | 'weekly_recap'
  // 工具
  | 'asset_tagging'
  | 'title_suggestion'
  | 'embedding'

export const AI_USAGE_KEYS: readonly AiUsageKey[] = [
  'agent_chat',
  'agent_chat_deep',
  'agent_proactive',
  'design_vision_light',
  'design_vision_deep',
  'design_compare',
  'theme_from_mood',
  'theme_name',
  'font_pairing',
  'daily_card',
  'daily_prompt',
  'greeting',
  'memory_proposal',
  'insight_phrasing',
  'weekly_recap',
  'asset_tagging',
  'title_suggestion',
  'embedding',
]

/**
 * 不可跨 space 快取的用途（§5.3）。這些輸出必須反映該 space 的獨特脈絡，
 * 跨 space 快取會造成資料外洩（把 A 的分析回給 B）—— 這是隱私事故不是效能問題。
 */
export const UNCACHEABLE_USAGE: ReadonlySet<AiUsageKey> = new Set<AiUsageKey>([
  'agent_chat',
  'agent_chat_deep',
  'memory_proposal',
  'design_vision_light',
  'design_vision_deep',
  'design_compare',
  'insight_phrasing',
  'weekly_recap',
])

export function isCacheable(usageKey: AiUsageKey): boolean {
  return !UNCACHEABLE_USAGE.has(usageKey)
}
