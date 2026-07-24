import { describe, it, expect, beforeEach } from 'vitest'
import { runCandidateChain, type RunDeps } from './router.js'
import { _resetBreakers } from './circuit-breaker.js'
import type { UsageCandidate } from './candidates.js'

const CHAIN: UsageCandidate[] = [
  { model: 'groq:free-a', role: 'primary' },
  { model: 'cerebras:free-b', role: 'fallback' },
  { model: 'anthropic:paid-c', role: 'escalate' },
]

function deps(over: Partial<RunDeps> = {}): RunDeps {
  return {
    hasKey: () => true,
    isFree: (m) => m.includes('free'),
    attempt: async () => ({ text: '這是一段夠長的正常回答，內容有意義。' }),
    ...over,
  }
}

beforeEach(() => _resetBreakers())

describe('runCandidateChain — §11 驗收', () => {
  it('一般情況走第一個免費候選（is_free、不 fallback）', async () => {
    const r = await runCandidateChain(CHAIN, deps())
    expect(r.candidate.model).toBe('groq:free-a')
    expect(r.attempts).toBe(1)
    expect(r.fellBack).toBe(false)
    expect(r.escalated).toBe(false)
  })

  it('第一個 429 → 無感切換到第二個（fellBack）', async () => {
    let call = 0
    const r = await runCandidateChain(
      CHAIN,
      deps({
        attempt: async (c) => {
          call += 1
          if (c.model === 'groq:free-a') throw new Error('429 rate limit')
          return { text: '第二個候選給出的正常且足夠長的回答。' }
        },
      }),
    )
    expect(r.candidate.model).toBe('cerebras:free-b')
    expect(r.fellBack).toBe(true)
    expect(call).toBe(2)
  })

  it('免費模型空輸出 → 升級到 escalate 候選（escalated）', async () => {
    const r = await runCandidateChain(
      CHAIN,
      deps({
        attempt: async (c) =>
          c.role === 'escalate'
            ? { text: '付費模型給出的完整回答，內容充分。' }
            : { text: '' },
      }),
    )
    expect(r.escalated).toBe(true)
    expect(r.candidate.model).toBe('anthropic:paid-c')
  })

  it('真錯誤（400）直接拋，不換模型，attempts=1', async () => {
    await expect(
      runCandidateChain(
        CHAIN,
        deps({ attempt: async () => Promise.reject(new Error('400 invalid prompt')) }),
      ),
    ).rejects.toThrow(/400/)
  })

  it('缺金鑰的候選被跳過，不計 attempt', async () => {
    const seen: string[] = []
    const r = await runCandidateChain(
      CHAIN,
      deps({
        hasKey: (c) => c.model !== 'groq:free-a', // 第一個沒金鑰
        attempt: async (c) => {
          seen.push(c.model)
          return { text: '第二個候選的正常回答，長度足夠。' }
        },
      }),
    )
    expect(seen).not.toContain('groq:free-a')
    expect(r.candidate.model).toBe('cerebras:free-b')
    expect(r.attempts).toBe(1) // 跳過的不計
  })

  it('付費預算用盡 → 濾掉付費候選、degraded=true', async () => {
    const r = await runCandidateChain(
      CHAIN,
      deps({
        // 只有付費候選能給好答案，但預算用盡把它濾掉了 → 用免費的
        attempt: async () => ({ text: '免費模型的正常回答，長度足夠有意義。' }),
      }),
      { paidBudgetExhausted: true },
    )
    expect(r.degraded).toBe(true)
    expect(r.candidate.model).not.toBe('anthropic:paid-c')
  })

  it('升級後仍低信心且原輸出非空 → 保留原輸出（不多付錢換爛答案）', async () => {
    // primary 低信心（拒答但非空）→ 觸發升級；escalate 也低信心 → 保留 primary 輸出
    const r = await runCandidateChain(
      [
        { model: 'groq:free-a', role: 'primary' },
        { model: 'anthropic:paid-c', role: 'escalate' },
      ],
      deps({
        attempt: async (c) =>
          c.role === 'escalate' ? { text: '短' } : { text: '抱歉，我無法回答這個問題。' },
      }),
    )
    expect(r.escalated).toBe(true)
    expect(r.candidate.model).toBe('groq:free-a') // 保留原輸出
    expect(r.result.text).toContain('抱歉')
  })

  it('schema 驗證失敗視同低信心 → 觸發升級', async () => {
    const r = await runCandidateChain(
      [
        { model: 'groq:free-a', role: 'primary' },
        { model: 'anthropic:paid-c', role: 'escalate' },
      ],
      deps({
        attempt: async (c) =>
          c.role === 'escalate'
            ? { text: '{"valid":true}', schemaValid: true }
            : { text: '{"broken', schemaValid: false },
      }),
      { hasSchema: true },
    )
    expect(r.escalated).toBe(true)
    expect(r.candidate.model).toBe('anthropic:paid-c')
  })

  it('全部候選失敗 → 拋 AllCandidatesFailedError', async () => {
    await expect(
      runCandidateChain(
        CHAIN,
        deps({ attempt: async () => Promise.reject(new Error('503 overloaded')) }),
      ),
    ).rejects.toThrow(/所有候選失敗/)
  })
})
