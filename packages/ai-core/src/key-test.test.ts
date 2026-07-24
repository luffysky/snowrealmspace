import { describe, it, expect } from 'vitest'
import { testProviderKey, maskKey, PROVIDER_META } from './key-test.js'

function mockFetch(status: number, body = ''): typeof fetch {
  return (async () => new Response(body, { status })) as unknown as typeof fetch
}

describe('testProviderKey', () => {
  it('200 → ok', async () => {
    expect((await testProviderKey('groq', 'gsk_x', mockFetch(200))).ok).toBe(true)
  })
  it('401 → 不 ok，帶 status + body', async () => {
    const r = await testProviderKey('groq', 'bad', mockFetch(401, 'invalid key'))
    expect(r.ok).toBe(false)
    expect(r.status).toBe(401)
    expect(r.body).toContain('invalid')
  })
  it('各家都有對應端點（不會回 unknown provider）', async () => {
    for (const p of ['anthropic', 'openai', 'google', 'groq', 'cerebras', 'mistral', 'openrouter'] as const) {
      const r = await testProviderKey(p, 'k', mockFetch(200))
      expect(r.ok, p).toBe(true)
    }
  })
  it('連線失敗 → 回錯誤訊息不拋', async () => {
    const throwing = (async () => {
      throw new Error('network down')
    }) as unknown as typeof fetch
    const r = await testProviderKey('groq', 'k', throwing)
    expect(r.ok).toBe(false)
    expect(r.body).toContain('連線失敗')
  })
})

describe('maskKey', () => {
  it('露頭尾、遮中間', () => {
    expect(maskKey('gsk_abcdef1234567890')).toBe('gsk_ab…7890')
  })
  it('太短 → ***', () => {
    expect(maskKey('short')).toBe('***')
  })
})

describe('PROVIDER_META', () => {
  it('免費 provider 含 groq/google/cerebras/mistral/openrouter', () => {
    const free = PROVIDER_META.filter((p) => p.free).map((p) => p.provider)
    expect(free).toEqual(expect.arrayContaining(['groq', 'google', 'cerebras', 'mistral', 'openrouter']))
  })
  it('anthropic/openai 標付費', () => {
    expect(PROVIDER_META.find((p) => p.provider === 'anthropic')!.free).toBe(false)
  })
})
