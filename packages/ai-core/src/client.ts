import { endpointFor, protocolFor, stripLoneSurrogates } from './providers.js'
import type {
  AICompletionRequest,
  AICompletionResponse,
  AIMessage,
  AIContentBlock,
  ToolCall,
} from './types.js'

/**
 * 統一的 AI 呼叫（§3.2）。三種協定收斂成一個 callAI()。
 * 所有送出的文字都過 stripLoneSurrogates（§3.3a）。
 *
 * 這一層只管「把一次請求送出去、把回應正規化」——不做 fallback（那是 router 的事）。
 */

function cleanText(s: string): string {
  return stripLoneSurrogates(s)
}

function cleanContent(content: string | AIContentBlock[]): string | AIContentBlock[] {
  if (typeof content === 'string') return cleanText(content)
  return content.map((b) => (b.type === 'text' ? { ...b, text: cleanText(b.text) } : b))
}

/** 抽出 system 訊息（Anthropic/Google 的 system 是獨立欄位）。 */
function splitSystem(messages: AIMessage[]): { system: string; rest: AIMessage[] } {
  const sys = messages.filter((m) => m.role === 'system')
  const rest = messages.filter((m) => m.role !== 'system')
  const system = sys
    .map((m) => (typeof m.content === 'string' ? m.content : m.content.map((b) => (b.type === 'text' ? b.text : '')).join('')))
    .join('\n')
  return { system: cleanText(system), rest }
}

export async function callAI(req: AICompletionRequest): Promise<AICompletionResponse> {
  const doFetch = req.fetchImpl ?? fetch
  const started = Date.now()
  const protocol = protocolFor(req.provider)

  const cleaned: AIMessage[] = req.messages.map((m) => ({ role: m.role, content: cleanContent(m.content) }))

  let response: Response
  if (protocol === 'anthropic') {
    response = await callAnthropic(req, cleaned, doFetch)
  } else if (protocol === 'google') {
    response = await callGoogle(req, cleaned, doFetch)
  } else {
    response = await callOpenAI(req, cleaned, doFetch)
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    // 訊息帶 status code，讓 isQuotaOrTransientError 判定
    throw new Error(`${response.status} ${response.statusText} ${body.slice(0, 300)}`)
  }

  const json: unknown = await response.json()
  const parsed =
    protocol === 'anthropic'
      ? parseAnthropic(json)
      : protocol === 'google'
        ? parseGoogle(json)
        : parseOpenAI(json)

  return { ...parsed, latencyMs: Date.now() - started, raw: json }
}

// ── OpenAI 相容協定 ───────────────────────────────────
function contentToOpenAI(content: string | AIContentBlock[]): unknown {
  if (typeof content === 'string') return content
  return content.map((b) =>
    b.type === 'text'
      ? { type: 'text', text: b.text }
      : { type: 'image_url', image_url: { url: `data:${b.mediaType};base64,${b.data}` } },
  )
}

async function callOpenAI(req: AICompletionRequest, messages: AIMessage[], doFetch: typeof fetch): Promise<Response> {
  const body: Record<string, unknown> = {
    model: req.model,
    messages: messages.map((m) => ({ role: m.role, content: contentToOpenAI(m.content) })),
  }
  if (req.temperature !== undefined) body.temperature = req.temperature
  if (req.maxTokens !== undefined) body.max_tokens = req.maxTokens
  if (req.tools?.length) {
    body.tools = req.tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }))
  }
  if (req.responseSchema) body.response_format = { type: 'json_object' }

  return doFetch(endpointFor(req.provider, req.cloudflareAccountId), {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${req.apiKey}` },
    body: JSON.stringify(body),
  })
}

function parseOpenAI(json: unknown): Omit<AICompletionResponse, 'latencyMs' | 'raw'> {
  const j = json as {
    choices?: { message?: { content?: string; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[]
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }
  const msg = j.choices?.[0]?.message
  const toolCalls: ToolCall[] | undefined = msg?.tool_calls?.map((t) => ({
    id: t.id,
    name: t.function.name,
    arguments: safeJson(t.function.arguments),
  }))
  return {
    text: msg?.content ?? '',
    ...(toolCalls?.length ? { toolCalls } : {}),
    tokensInput: j.usage?.prompt_tokens ?? 0,
    tokensOutput: j.usage?.completion_tokens ?? 0,
  }
}

// ── Anthropic 協定 ────────────────────────────────────
function contentToAnthropic(content: string | AIContentBlock[]): unknown {
  if (typeof content === 'string') return content
  return content.map((b) =>
    b.type === 'text'
      ? { type: 'text', text: b.text }
      : { type: 'image', source: { type: 'base64', media_type: b.mediaType, data: b.data } },
  )
}

async function callAnthropic(req: AICompletionRequest, messages: AIMessage[], doFetch: typeof fetch): Promise<Response> {
  const { system, rest } = splitSystem(messages)
  const body: Record<string, unknown> = {
    model: req.model,
    max_tokens: req.maxTokens ?? 1024,
    messages: rest.map((m) => ({ role: m.role, content: contentToAnthropic(m.content) })),
  }
  if (system) body.system = system
  if (req.temperature !== undefined) body.temperature = req.temperature
  if (req.tools?.length) {
    body.tools = req.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }))
  }
  return doFetch(endpointFor(req.provider), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': req.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })
}

function parseAnthropic(json: unknown): Omit<AICompletionResponse, 'latencyMs' | 'raw'> {
  const j = json as {
    content?: ({ type: 'text'; text: string } | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> })[]
    usage?: { input_tokens?: number; output_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number }
  }
  const text = (j.content ?? [])
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map((b) => b.text)
    .join('')
  const toolCalls: ToolCall[] = (j.content ?? [])
    .filter((b): b is { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } => b.type === 'tool_use')
    .map((b) => ({ id: b.id, name: b.name, arguments: b.input }))
  return {
    text,
    ...(toolCalls.length ? { toolCalls } : {}),
    tokensInput: j.usage?.input_tokens ?? 0,
    tokensOutput: j.usage?.output_tokens ?? 0,
    ...(j.usage?.cache_creation_input_tokens ? { cacheWriteTokens: j.usage.cache_creation_input_tokens } : {}),
    ...(j.usage?.cache_read_input_tokens ? { cacheReadTokens: j.usage.cache_read_input_tokens } : {}),
  }
}

// ── Google 協定 ───────────────────────────────────────
function contentToGoogleParts(content: string | AIContentBlock[]): unknown[] {
  if (typeof content === 'string') return [{ text: content }]
  return content.map((b) =>
    b.type === 'text' ? { text: b.text } : { inlineData: { mimeType: b.mediaType, data: b.data } },
  )
}

async function callGoogle(req: AICompletionRequest, messages: AIMessage[], doFetch: typeof fetch): Promise<Response> {
  const { system, rest } = splitSystem(messages)
  const body: Record<string, unknown> = {
    contents: rest.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: contentToGoogleParts(m.content),
    })),
  }
  if (system) body.systemInstruction = { parts: [{ text: system }] }
  const genConfig: Record<string, unknown> = {}
  if (req.temperature !== undefined) genConfig.temperature = req.temperature
  if (req.maxTokens !== undefined) genConfig.maxOutputTokens = req.maxTokens
  if (req.responseSchema) genConfig.responseMimeType = 'application/json'
  if (Object.keys(genConfig).length) body.generationConfig = genConfig

  const base = endpointFor(req.provider)
  const url = `${base}/models/${req.model}:generateContent?key=${req.apiKey}`
  return doFetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function parseGoogle(json: unknown): Omit<AICompletionResponse, 'latencyMs' | 'raw'> {
  const j = json as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
  }
  const text = (j.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('')
  return {
    text,
    tokensInput: j.usageMetadata?.promptTokenCount ?? 0,
    tokensOutput: j.usageMetadata?.candidatesTokenCount ?? 0,
  }
}

function safeJson(s: string): Record<string, unknown> {
  try {
    const v: unknown = JSON.parse(s)
    return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}
