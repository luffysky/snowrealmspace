import type { ProviderId } from './providers.js'

/**
 * 驗證某 provider 的 API key 是否有效。移植自 ai 島 ai-key-test.ts。
 * 各家打一個最小請求／列模型端點，回 { ok, status, body }。fetchImpl 可注入以便測試。
 */
export type KeyTestResult = { ok: boolean; status?: number; body?: string }

async function timed(url: string, init: RequestInit, fetchImpl: typeof fetch): Promise<Response> {
  return fetchImpl(url, { ...init, signal: AbortSignal.timeout(15_000) })
}

export async function testProviderKey(
  provider: ProviderId,
  key: string,
  fetchImpl: typeof fetch = fetch,
): Promise<KeyTestResult> {
  const ok = (res: Response): KeyTestResult => ({ ok: true, status: res.status })
  const bad = async (res: Response): Promise<KeyTestResult> => ({
    ok: false,
    status: res.status,
    body: (await res.text()).slice(0, 300),
  })
  try {
    let res: Response
    switch (provider) {
      case 'anthropic':
        res = await timed(
          'https://api.anthropic.com/v1/messages',
          {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 5, messages: [{ role: 'user', content: 'hi' }] }),
          },
          fetchImpl,
        )
        break
      case 'openai':
        res = await timed('https://api.openai.com/v1/models', { headers: { authorization: `Bearer ${key}` } }, fetchImpl)
        break
      case 'google':
        res = await timed(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, {}, fetchImpl)
        break
      case 'groq':
        res = await timed('https://api.groq.com/openai/v1/models', { headers: { authorization: `Bearer ${key}` } }, fetchImpl)
        break
      case 'cerebras':
        res = await timed('https://api.cerebras.ai/v1/models', { headers: { authorization: `Bearer ${key}` } }, fetchImpl)
        break
      case 'mistral':
        res = await timed('https://api.mistral.ai/v1/models', { headers: { authorization: `Bearer ${key}` } }, fetchImpl)
        break
      case 'openrouter':
        res = await timed('https://openrouter.ai/api/v1/key', { headers: { authorization: `Bearer ${key}` } }, fetchImpl)
        break
      case 'nvidia':
        res = await timed('https://integrate.api.nvidia.com/v1/models', { headers: { authorization: `Bearer ${key}` } }, fetchImpl)
        break
      case 'sambanova':
        res = await timed('https://api.sambanova.ai/v1/models', { headers: { authorization: `Bearer ${key}` } }, fetchImpl)
        break
      default:
        return { ok: false, body: `不支援測試的 provider：${provider}` }
    }
    return res.ok ? ok(res) : await bad(res)
  } catch (e) {
    return { ok: false, body: `連線失敗：${(e as Error)?.message ?? 'unknown'}` }
  }
}

/** 遮蔽金鑰供顯示（只露頭尾）。 */
export function maskKey(key: string): string {
  if (key.length < 12) return '***'
  return `${key.slice(0, 6)}…${key.slice(-4)}`
}

/** 後台顯示用的 provider metadata（取得金鑰連結、格式提示、免費與否）。 */
export type ProviderMeta = {
  provider: ProviderId
  label: string
  url: string
  placeholder: string
  hint: string
  free: boolean
}

export const PROVIDER_META: ProviderMeta[] = [
  { provider: 'groq', label: 'Groq（Llama 等，免費、延遲最低）', url: 'https://console.groq.com/keys', placeholder: 'gsk_...', hint: '以 gsk_ 開頭', free: true },
  { provider: 'google', label: 'Google Gemini（免費，唯一可靠的免費 vision）', url: 'https://aistudio.google.com/apikey', placeholder: 'AIza...', hint: '以 AIza 開頭', free: true },
  { provider: 'cerebras', label: 'Cerebras（免費，~1M tokens/日）', url: 'https://cloud.cerebras.ai', placeholder: 'csk-...', hint: '以 csk- 開頭', free: true },
  { provider: 'mistral', label: 'Mistral（免費 experiment 層）', url: 'https://console.mistral.ai/api-keys', placeholder: '...', hint: 'Mistral console 產生', free: true },
  { provider: 'openrouter', label: 'OpenRouter（一把通多家，可當保底）', url: 'https://openrouter.ai/keys', placeholder: 'sk-or-...', hint: '以 sk-or- 開頭', free: true },
  { provider: 'anthropic', label: 'Anthropic Claude（付費，升級路徑用）', url: 'https://console.anthropic.com/settings/keys', placeholder: 'sk-ant-...', hint: '以 sk-ant- 開頭', free: false },
  { provider: 'openai', label: 'OpenAI（付費）', url: 'https://platform.openai.com/api-keys', placeholder: 'sk-...', hint: '以 sk- / sk-proj- 開頭', free: false },
]
