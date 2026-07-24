import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  completeForUsage,
  type CompleteDeps,
  type ModelCallResult,
  type UsageLogEntry,
} from './complete.js'
import { QuotaExceededError } from './errors.js'
import { _resetBreakers } from './circuit-breaker.js'
import type { UsageCandidate } from './candidates.js'

const CHAIN: UsageCandidate[] = [
  { model: 'groq:free-a', role: 'primary' },
  { model: 'anthropic:paid-b', role: 'escalate' },
]

function okCall(text: string): ModelCallResult {
  return { text, tokensInput: 10, tokensOutput: 5, latencyMs: 1 }
}

function deps(over: Partial<CompleteDeps> = {}): CompleteDeps {
  return {
    getCandidates: async () => CHAIN,
    getKey: async () => 'key',
    isFree: (m) => m.includes('free'),
    budget: async () => ({ freeExhausted: false, paidExhausted: false }),
    call: async () => okCall('這是一段夠長且有意義的正常回答內容。'),
    logUsage: async () => {},
    ...over,
  }
}

beforeEach(() => _resetBreakers())

describe('completeForUsage', () => {
  it('一般走免費候選、寫 usage log', async () => {
    const logUsage = vi.fn(async (_e: UsageLogEntry) => {})
    const r = await completeForUsage('agent_chat', { spaceId: 's1', user: '嗨' }, deps({ logUsage }))
    expect(r.model).toBe('groq:free-a')
    expect(r.isFree).toBe(true)
    expect(r.cacheHit).toBeNull()
    expect(logUsage).toHaveBeenCalledOnce()
    expect(logUsage.mock.calls[0]![0].tokensInput).toBe(10)
  })

  it('免費額度用盡 → 拋 QuotaExceededError', async () => {
    await expect(
      completeForUsage('agent_chat', { spaceId: 's1', user: '嗨' }, deps({ budget: async () => ({ freeExhausted: true, paidExhausted: false }) })),
    ).rejects.toBeInstanceOf(QuotaExceededError)
  })

  it('付費預算用盡 → degraded、只用免費候選', async () => {
    const r = await completeForUsage(
      'agent_chat_deep',
      { spaceId: 's1', user: '深入分析' },
      deps({
        getCandidates: async () => [
          { model: 'anthropic:paid-b', role: 'primary' },
          { model: 'google:free-c', role: 'fallback' },
        ],
        budget: async () => ({ freeExhausted: false, paidExhausted: true }),
        call: async () => okCall('免費模型完成的分析，內容足夠。'),
      }),
    )
    expect(r.degraded).toBe(true)
    expect(r.model).toBe('google:free-c')
  })

  it('可快取用途命中快取 → 直接回、attempts=0、不呼叫模型', async () => {
    const call = vi.fn(async () => okCall('x'))
    const r = await completeForUsage(
      'greeting',
      { spaceId: 's1', user: '早安' },
      deps({ call, cacheGet: async () => '快取的問候語' }),
    )
    expect(r.text).toBe('快取的問候語')
    expect(r.cacheHit).toBe('exact')
    expect(r.attempts).toBe(0)
    expect(call).not.toHaveBeenCalled()
  })

  it('不可快取用途（agent_chat）不查快取', async () => {
    const cacheGet = vi.fn(async () => '不該被用到')
    const r = await completeForUsage('agent_chat', { spaceId: 's1', user: '嗨' }, deps({ cacheGet }))
    expect(cacheGet).not.toHaveBeenCalled()
    expect(r.text).not.toBe('不該被用到')
  })

  it('缺金鑰的 provider 被跳過', async () => {
    const seen: string[] = []
    const r = await completeForUsage(
      'agent_chat',
      { spaceId: 's1', user: '嗨' },
      deps({
        getKey: async (p) => (p === 'groq' ? null : 'key'),
        call: async (c) => {
          seen.push(c.model)
          return okCall('第二候選的正常回答，長度足夠。')
        },
      }),
    )
    expect(seen).not.toContain('free-a')
    expect(r.model).toBe('anthropic:paid-b')
  })

  it('責任分離：candidate.model 的 provider 前綴在呼叫時被剝掉', async () => {
    let calledModel = ''
    await completeForUsage(
      'agent_chat',
      { spaceId: 's1', user: '嗨' },
      deps({
        call: async (c) => {
          calledModel = c.model
          return okCall('正常回答，長度足夠有意義的內容。')
        },
      }),
    )
    expect(calledModel).toBe('free-a') // 'groq:' 前綴已剝掉
  })
})
