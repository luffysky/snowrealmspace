/**
 * Provider 層基礎。見 docs/spec/12-ai-model-routing.md §3。
 *
 * 三種協定（OpenAI 相容 / Anthropic / Google）、九家 provider。
 * 這個檔案是純邏輯（endpoint、名稱解析、文字清理、計費）——
 * 實際 HTTP 呼叫（callAI/streamAI）在 client.ts，需要 fetch 與金鑰。
 */

export type ProviderId =
  | 'anthropic'
  | 'google'
  | 'openai'
  | 'groq'
  | 'openrouter'
  | 'cerebras'
  | 'nvidia'
  | 'sambanova'
  | 'mistral'
  | 'cloudflare'

export const PROVIDER_IDS: readonly ProviderId[] = [
  'anthropic',
  'google',
  'openai',
  'groq',
  'openrouter',
  'cerebras',
  'nvidia',
  'sambanova',
  'mistral',
  'cloudflare',
]

/** OpenAI 相容協定的 provider —— 用同一套 request/response 格式。 */
export const OPENAI_COMPATIBLE: ReadonlySet<ProviderId> = new Set<ProviderId>([
  'openai',
  'groq',
  'openrouter',
  'cerebras',
  'nvidia',
  'sambanova',
  'mistral',
  'cloudflare',
])

export type Protocol = 'openai' | 'anthropic' | 'google'

export function protocolFor(provider: ProviderId): Protocol {
  if (provider === 'anthropic') return 'anthropic'
  if (provider === 'google') return 'google'
  return 'openai'
}

export function endpointFor(provider: ProviderId, cloudflareAccountId?: string): string {
  switch (provider) {
    case 'groq':
      return 'https://api.groq.com/openai/v1/chat/completions'
    case 'openrouter':
      return 'https://openrouter.ai/api/v1/chat/completions'
    case 'cerebras':
      return 'https://api.cerebras.ai/v1/chat/completions'
    case 'nvidia':
      return 'https://integrate.api.nvidia.com/v1/chat/completions'
    case 'sambanova':
      return 'https://api.sambanova.ai/v1/chat/completions'
    case 'mistral':
      return 'https://api.mistral.ai/v1/chat/completions'
    case 'cloudflare':
      return `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId ?? ''}/ai/v1/chat/completions`
    case 'openai':
      return 'https://api.openai.com/v1/chat/completions'
    case 'anthropic':
      return 'https://api.anthropic.com/v1/messages'
    case 'google':
      return 'https://generativelanguage.googleapis.com/v1beta'
  }
}

/** 明確前綴優先：'groq:llama-x' → { provider:'groq', model:'llama-x' } */
export function splitProviderPrefix(model: string): { provider?: ProviderId; model: string } {
  const idx = model.indexOf(':')
  if (idx > 0) {
    const maybe = model.slice(0, idx) as ProviderId
    if (PROVIDER_IDS.includes(maybe)) {
      return { provider: maybe, model: model.slice(idx + 1) }
    }
  }
  return { model }
}

/**
 * 無前綴時從名稱推斷 provider（§4.1）。
 * 建議一律用明確前綴；這是給舊資料的相容路徑。
 * 注意順序：gpt-oss/llama/qwen/mixtral 的判斷必須在 '/' 之前。
 */
export function providerFromModel(model: string): ProviderId {
  const explicit = splitProviderPrefix(model)
  if (explicit.provider) return explicit.provider

  const m = model.toLowerCase()
  if (m.startsWith('@cf/')) return 'cloudflare'
  if (m.startsWith('claude')) return 'anthropic'
  if (m.startsWith('gemini') || m.startsWith('text-embedding-00')) return 'google'
  if (/gpt-oss|llama|qwen|mixtral/.test(m)) return 'groq'
  if (m.includes('/')) return 'openrouter'
  if (/^(gpt|o1|o3|o4)/.test(m)) return 'openai'
  return 'anthropic'
}

/**
 * 落單 surrogate 清理（§3.3a）。
 * text.slice() 剛好切在 emoji 中間 → 半個 UTF-16 surrogate → JSON.stringify 產出
 * 不合法 JSON → Anthropic 回 400。所有送出的文字都要過這個函式。
 */
export function stripLoneSurrogates(s: string): string {
  if (!s) return s
  return s.replace(
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
    '',
  )
}

/** Anthropic prompt cache 邊界標記（§3.3b）。四個零寬空格。 */
export const PROMPT_CACHE_MARKER = String.fromCharCode(0x200b, 0x200b, 0x200b, 0x200b)

/**
 * 計費用的等效 input token（§3.3c）。
 * 直接用 input_tokens 會嚴重低估 —— 它只含未命中的部分。
 * cache write 1.25×、cache read 0.1×。
 */
export function billableInputTokens(input: number, cacheWrite = 0, cacheRead = 0): number {
  return input + cacheWrite * 1.25 + cacheRead * 0.1
}
