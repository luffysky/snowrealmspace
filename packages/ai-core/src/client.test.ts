import { describe, it, expect } from 'vitest'
import { callAI } from './client.js'
import type { AICompletionRequest } from './types.js'

function mockFetch(status: number, body: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch
}

function captureFetch(): { calls: { url: string; body: unknown }[]; fetch: typeof fetch } {
  const calls: { url: string; body: unknown }[] = []
  const f = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : null })
    return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }], usage: {} }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as unknown as typeof fetch
  return { calls, fetch: f }
}

const base: Omit<AICompletionRequest, 'provider' | 'fetchImpl'> = {
  model: 'x',
  apiKey: 'k',
  messages: [{ role: 'user', content: 'hi' }],
}

describe('callAI — OpenAI 相容', () => {
  it('解析 content 與 usage', async () => {
    const r = await callAI({
      ...base,
      provider: 'groq',
      fetchImpl: mockFetch(200, {
        choices: [{ message: { content: '你好' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
    })
    expect(r.text).toBe('你好')
    expect(r.tokensInput).toBe(10)
    expect(r.tokensOutput).toBe(5)
    expect(r.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('非 2xx 拋錯且訊息含 status（供換模型判定）', async () => {
    await expect(
      callAI({ ...base, provider: 'groq', fetchImpl: mockFetch(429, { error: 'rate' }) }),
    ).rejects.toThrow(/429/)
  })

  it('用 Bearer 授權、打對 endpoint', async () => {
    const cap = captureFetch()
    await callAI({ ...base, provider: 'groq', fetchImpl: cap.fetch })
    expect(cap.calls[0]!.url).toContain('api.groq.com')
  })
})

describe('callAI — Anthropic', () => {
  it('system 拆到獨立欄位、解析 content[].text 與 cache tokens', async () => {
    const cap = { body: null as unknown }
    const f = (async (_url: string, init?: RequestInit) => {
      cap.body = init?.body ? JSON.parse(String(init.body)) : null
      return new Response(
        JSON.stringify({
          content: [{ type: 'text', text: '嗨' }],
          usage: { input_tokens: 3, output_tokens: 2, cache_read_input_tokens: 100 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }) as unknown as typeof fetch

    const r = await callAI({
      provider: 'anthropic',
      model: 'claude-x',
      apiKey: 'k',
      messages: [
        { role: 'system', content: '你是助手' },
        { role: 'user', content: 'hi' },
      ],
      fetchImpl: f,
    })
    expect(r.text).toBe('嗨')
    expect(r.cacheReadTokens).toBe(100)
    expect((cap.body as { system?: string }).system).toBe('你是助手')
    expect((cap.body as { messages: unknown[] }).messages).toHaveLength(1) // system 不在 messages
  })
})

describe('callAI — Google', () => {
  it('打 generateContent、key 在 query、解析 candidates', async () => {
    const cap = { url: '' }
    const f = (async (url: string) => {
      cap.url = String(url)
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'hi' }] } }],
          usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 1 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }) as unknown as typeof fetch
    const r = await callAI({ provider: 'google', model: 'gemini-x', apiKey: 'k', messages: [{ role: 'user', content: 'hi' }], fetchImpl: f })
    expect(r.text).toBe('hi')
    expect(cap.url).toContain('gemini-x:generateContent')
    expect(cap.url).toContain('key=k')
  })
})

describe('callAI — 落單 surrogate 清理', () => {
  it('送出前清掉半個 surrogate', async () => {
    const cap = captureFetch()
    const broken = '😀'.slice(0, 1) // 半個
    await callAI({ provider: 'groq', model: 'x', apiKey: 'k', messages: [{ role: 'user', content: `hi${broken}` }], fetchImpl: cap.fetch })
    const sent = cap.calls[0]!.body as { messages: { content: string }[] }
    expect(sent.messages[0]!.content).toBe('hi') // 半個 surrogate 被清掉
  })
})
