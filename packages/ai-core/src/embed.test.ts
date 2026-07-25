import { describe, it, expect } from 'vitest'
import { embedText, toVectorLiteral, EMBEDDING_DIMS } from './embed.js'

function captureFetch(body: unknown, status = 200): {
  calls: { url: string; body: unknown }[]
  fetch: typeof fetch
} {
  const calls: { url: string; body: unknown }[] = []
  const f = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : null })
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  }) as unknown as typeof fetch
  return { calls, fetch: f }
}

describe('toVectorLiteral', () => {
  it('轉成 pgvector 字面量', () => {
    expect(toVectorLiteral([0.1, 0.2, -0.3])).toBe('[0.1,0.2,-0.3]')
  })
})

describe('embedText — openai 相容', () => {
  it('打 /embeddings、帶 dimensions=768、解析向量', async () => {
    const cap = captureFetch({ data: [{ embedding: [0.1, 0.2, 0.3] }], usage: { prompt_tokens: 4 } })
    const r = await embedText({
      provider: 'openai',
      model: 'openai:text-embedding-3-small',
      apiKey: 'k',
      input: 'hello',
      fetchImpl: cap.fetch,
    })
    expect(cap.calls[0]!.url).toBe('https://api.openai.com/v1/embeddings')
    const sent = cap.calls[0]!.body as { model: string; dimensions: number }
    expect(sent.model).toBe('text-embedding-3-small') // provider 前綴被剝掉
    expect(sent.dimensions).toBe(EMBEDDING_DIMS)
    expect(r.vector).toEqual([0.1, 0.2, 0.3])
    expect(r.tokensInput).toBe(4)
  })

  it('空向量拋錯（誠實失敗，不寫壞資料）', async () => {
    const cap = captureFetch({ data: [{ embedding: [] }] })
    await expect(
      embedText({ provider: 'openai', model: 'text-embedding-3-small', apiKey: 'k', input: 'x', fetchImpl: cap.fetch }),
    ).rejects.toThrow(/空向量/)
  })

  it('非 2xx 拋錯且含 status', async () => {
    const cap = captureFetch({ error: 'rate' }, 429)
    await expect(
      embedText({ provider: 'openai', model: 'text-embedding-3-small', apiKey: 'k', input: 'x', fetchImpl: cap.fetch }),
    ).rejects.toThrow(/429/)
  })
})

describe('embedText — google', () => {
  it('打 embedContent、帶 outputDimensionality、解析 values', async () => {
    const cap = captureFetch({ embedding: { values: [0.4, 0.5] } })
    const r = await embedText({
      provider: 'google',
      model: 'google:text-embedding-004',
      apiKey: 'gk',
      input: 'hi',
      fetchImpl: cap.fetch,
    })
    expect(cap.calls[0]!.url).toContain('text-embedding-004:embedContent')
    expect(cap.calls[0]!.url).toContain('key=gk')
    const sent = cap.calls[0]!.body as { outputDimensionality: number }
    expect(sent.outputDimensionality).toBe(EMBEDDING_DIMS)
    expect(r.vector).toEqual([0.4, 0.5])
  })
})

describe('embedText — anthropic', () => {
  it('沒有 embedding 端點 → 拋錯', async () => {
    const cap = captureFetch({})
    await expect(
      embedText({ provider: 'anthropic', model: 'claude', apiKey: 'k', input: 'x', fetchImpl: cap.fetch }),
    ).rejects.toThrow(/anthropic/)
  })
})
