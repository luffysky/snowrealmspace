import type { AiUsageKey } from './usage-keys.js'
import type { UsageCandidate } from './candidates.js'

/**
 * 預設候選鏈（§2.1）。這是 seed 進 ai_usage_models 表的初始值 ——
 * 上線後由後台在 DB 維護（模型會退役、免費額度會變），這裡只是起點與離線 fallback。
 *
 * 免費優先：只有 agent_chat_deep / design_vision_deep，以及 agent_chat 的 escalate
 * 這三條會花錢。其餘 14 個 usage key 全走免費層。
 * 全部用明確 provider: 前綴（§4.1 建議）。
 */
export const DEFAULT_CANDIDATES: Record<AiUsageKey, UsageCandidate[]> = {
  agent_chat: [
    { model: 'groq:llama-3.3-70b-versatile', role: 'primary' },
    { model: 'cerebras:llama-3.3-70b', role: 'fallback' },
    { model: 'mistral:mistral-small-latest', role: 'fallback' },
    { model: 'google:gemini-2.0-flash', role: 'fallback' },
    { model: 'anthropic:claude-haiku-4-5-20251001', role: 'escalate' },
  ],
  agent_chat_deep: [
    { model: 'anthropic:claude-opus-4-8', role: 'primary' },
    { model: 'anthropic:claude-haiku-4-5-20251001', role: 'fallback' },
    { model: 'google:gemini-2.0-flash', role: 'fallback' },
  ],
  agent_proactive: [
    { model: 'cerebras:llama-3.3-70b', role: 'primary' },
    { model: 'mistral:mistral-small-latest', role: 'fallback' },
    { model: 'groq:llama-3.3-70b-versatile', role: 'fallback' },
  ],
  design_vision_light: [
    { model: 'google:gemini-2.0-flash', role: 'primary' },
    { model: 'groq:llama-3.2-90b-vision-preview', role: 'fallback' },
    { model: 'openrouter:meta-llama/llama-3.2-11b-vision-instruct:free', role: 'fallback' },
  ],
  design_vision_deep: [
    { model: 'anthropic:claude-opus-4-8', role: 'primary' },
    { model: 'google:gemini-2.0-flash', role: 'fallback' },
  ],
  design_compare: [
    { model: 'google:gemini-2.0-flash', role: 'primary' },
    { model: 'anthropic:claude-haiku-4-5-20251001', role: 'escalate' },
  ],
  theme_from_mood: [
    { model: 'groq:llama-3.3-70b-versatile', role: 'primary' },
    { model: 'cerebras:llama-3.3-70b', role: 'fallback' },
  ],
  theme_name: [
    { model: 'groq:llama-3.3-70b-versatile', role: 'primary' },
    { model: 'mistral:mistral-small-latest', role: 'fallback' },
  ],
  font_pairing: [
    { model: 'cerebras:llama-3.3-70b', role: 'primary' },
    { model: 'groq:llama-3.3-70b-versatile', role: 'fallback' },
  ],
  daily_card: [
    { model: 'cerebras:llama-3.3-70b', role: 'primary' },
    { model: 'mistral:mistral-small-latest', role: 'fallback' },
    { model: 'groq:llama-3.3-70b-versatile', role: 'fallback' },
  ],
  daily_prompt: [
    { model: 'mistral:mistral-small-latest', role: 'primary' },
    { model: 'cerebras:llama-3.3-70b', role: 'fallback' },
  ],
  greeting: [
    { model: 'groq:llama-3.3-70b-versatile', role: 'primary' },
    { model: 'cerebras:llama-3.3-70b', role: 'fallback' },
  ],
  memory_proposal: [
    { model: 'cerebras:llama-3.3-70b', role: 'primary' },
    { model: 'groq:llama-3.3-70b-versatile', role: 'fallback' },
  ],
  insight_phrasing: [
    { model: 'mistral:mistral-small-latest', role: 'primary' },
    { model: 'cerebras:llama-3.3-70b', role: 'fallback' },
  ],
  weekly_recap: [
    { model: 'cerebras:llama-3.3-70b', role: 'primary' },
    { model: 'mistral:mistral-small-latest', role: 'fallback' },
  ],
  asset_tagging: [
    { model: 'groq:llama-3.3-70b-versatile', role: 'primary' },
    { model: 'cerebras:llama-3.3-70b', role: 'fallback' },
  ],
  title_suggestion: [
    { model: 'groq:llama-3.3-70b-versatile', role: 'primary' },
    { model: 'cerebras:llama-3.3-70b', role: 'fallback' },
  ],
  embedding: [{ model: 'google:text-embedding-004', role: 'primary' }],
}
