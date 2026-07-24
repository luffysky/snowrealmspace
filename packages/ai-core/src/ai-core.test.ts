import { describe, it, expect, beforeEach } from 'vitest'
import {
  stripLoneSurrogates,
  billableInputTokens,
  providerFromModel,
  splitProviderPrefix,
  protocolFor,
  endpointFor,
} from './providers.js'
import { isQuotaOrTransientError, looksLowConfidence } from './errors.js'
import {
  isProviderTripped,
  markProviderFailure,
  markProviderSuccess,
  _resetBreakers,
  CB_COOLDOWN_MS,
} from './circuit-breaker.js'
import { orderCandidates, escalateTarget, filterAffordable, type UsageCandidate } from './candidates.js'
import { normalizeQuestion } from './cache-key.js'
import { isCacheable, AI_USAGE_KEYS } from './usage-keys.js'
import { DEFAULT_CANDIDATES } from './default-candidates.js'

describe('stripLoneSurrogates', () => {
  it('移除落單的 high surrogate', () => {
    const emoji = '😀'
    const broken = emoji.slice(0, 1) // 半個 surrogate
    expect(stripLoneSurrogates(broken)).toBe('')
  })
  it('保留完整 emoji 與一般文字', () => {
    expect(stripLoneSurrogates('嗨😀你好')).toBe('嗨😀你好')
  })
  it('空字串安全', () => {
    expect(stripLoneSurrogates('')).toBe('')
  })
})

describe('billableInputTokens', () => {
  it('cache write 1.25×、read 0.1×', () => {
    expect(billableInputTokens(100, 40, 200)).toBe(100 + 40 * 1.25 + 200 * 0.1)
  })
  it('無 cache 時等於 input', () => {
    expect(billableInputTokens(100)).toBe(100)
  })
})

describe('providerFromModel / splitProviderPrefix', () => {
  it('明確前綴優先', () => {
    expect(providerFromModel('groq:llama-x')).toBe('groq')
    expect(splitProviderPrefix('groq:llama-x')).toEqual({ provider: 'groq', model: 'llama-x' })
  })
  it('claude → anthropic', () => {
    expect(providerFromModel('claude-opus-4-8')).toBe('anthropic')
  })
  it('gemini → google', () => {
    expect(providerFromModel('gemini-2.0-flash')).toBe('google')
  })
  it('llama 在 / 判斷之前 → groq', () => {
    expect(providerFromModel('llama-3.3-70b')).toBe('groq')
  })
  it('含 / 且非 llama → openrouter', () => {
    expect(providerFromModel('meta/some-model')).toBe('openrouter')
  })
  it('gpt → openai', () => {
    expect(providerFromModel('gpt-4o')).toBe('openai')
  })
  it('protocol 對應', () => {
    expect(protocolFor('groq')).toBe('openai')
    expect(protocolFor('anthropic')).toBe('anthropic')
    expect(protocolFor('google')).toBe('google')
  })
  it('cloudflare endpoint 帶 account id', () => {
    expect(endpointFor('cloudflare', 'acct123')).toContain('acct123')
  })
})

describe('isQuotaOrTransientError（值得換模型）', () => {
  it.each(['429 Too Many Requests', 'quota exceeded', 'model not found', '401 invalid api key', '503 overloaded', 'request timeout'])(
    '換模型：%s',
    (msg) => {
      expect(isQuotaOrTransientError(new Error(msg))).toBe(true)
    },
  )
  it.each(['400 invalid prompt format', 'content policy violation', 'schema mismatch'])(
    '不換模型（真錯誤）：%s',
    (msg) => {
      expect(isQuotaOrTransientError(new Error(msg))).toBe(false)
    },
  )
})

describe('looksLowConfidence', () => {
  it('空字串 → 低信心', () => {
    expect(looksLowConfidence('')).toBe(true)
  })
  it('過短 → 低信心', () => {
    expect(looksLowConfidence('好')).toBe(true)
  })
  it('拒答（中文）→ 低信心', () => {
    expect(looksLowConfidence('抱歉，我無法回答這個問題喔')).toBe(true)
  })
  it('拒答（英文）→ 低信心', () => {
    expect(looksLowConfidence("I'm sorry, I cannot help with that request")).toBe(true)
  })
  it('正常回答 → 非低信心', () => {
    expect(looksLowConfidence('這張海報的主色調偏暖，留白比例約三成，視覺重心在左上。')).toBe(false)
  })
})

describe('circuit breaker', () => {
  beforeEach(() => _resetBreakers())

  it('連續 2 次失敗才跳閘', () => {
    markProviderFailure('groq')
    expect(isProviderTripped('groq')).toBe(false)
    markProviderFailure('groq')
    expect(isProviderTripped('groq')).toBe(true)
  })
  it('成功即清空計數', () => {
    markProviderFailure('groq')
    markProviderSuccess('groq')
    markProviderFailure('groq')
    expect(isProviderTripped('groq')).toBe(false)
  })
  it('冷卻過後不再跳閘（注入時鐘）', () => {
    let now = 1000
    const clock = () => now
    markProviderFailure('groq', clock)
    markProviderFailure('groq', clock)
    expect(isProviderTripped('groq', clock)).toBe(true)
    now += CB_COOLDOWN_MS + 1
    expect(isProviderTripped('groq', clock)).toBe(false)
  })
})

describe('orderCandidates', () => {
  const chain: UsageCandidate[] = [
    { model: 'groq:a', role: 'primary' },
    { model: 'cerebras:b', role: 'fallback' },
    { model: 'anthropic:c', role: 'escalate' },
  ]
  beforeEach(() => _resetBreakers())

  it('跳閘的 provider 降到隊尾而非移除', () => {
    markProviderFailure('groq')
    markProviderFailure('groq') // groq 跳閘
    const ordered = orderCandidates(chain)
    expect(ordered.map((c) => c.model)).toEqual(['cerebras:b', 'anthropic:c', 'groq:a'])
    expect(ordered).toHaveLength(3) // 沒有被移除
  })

  it('forceEscalate 把 escalate 提到最前', () => {
    const ordered = orderCandidates(chain, { forceEscalate: true })
    expect(ordered[0]!.model).toBe('anthropic:c')
  })
})

describe('escalateTarget', () => {
  const chain: UsageCandidate[] = [
    { model: 'groq:a', role: 'primary' },
    { model: 'anthropic:c', role: 'escalate' },
  ]
  it('從 primary 升級到 escalate', () => {
    expect(escalateTarget(chain, chain[0]!)?.model).toBe('anthropic:c')
  })
  it('當前已是 escalate → 不再升級', () => {
    expect(escalateTarget(chain, chain[1]!)).toBeNull()
  })
  it('無 escalate 時用鏈尾', () => {
    const noEsc: UsageCandidate[] = [
      { model: 'groq:a', role: 'primary' },
      { model: 'cerebras:b', role: 'fallback' },
    ]
    expect(escalateTarget(noEsc, noEsc[0]!)?.model).toBe('cerebras:b')
  })
})

describe('filterAffordable（付費預算用盡 → degraded）', () => {
  const chain: UsageCandidate[] = [
    { model: 'anthropic:paid', role: 'primary' },
    { model: 'google:free', role: 'fallback' },
  ]
  const isFree = (m: string) => m.includes('free')
  it('預算未盡 → 全留', () => {
    expect(filterAffordable(chain, isFree, false)).toHaveLength(2)
  })
  it('預算用盡 → 只留免費', () => {
    const r = filterAffordable(chain, isFree, true)
    expect(r.map((c) => c.model)).toEqual(['google:free'])
  })
})

describe('normalizeQuestion', () => {
  it('全形空白、連續空白、大小寫、結尾標點都正規化', () => {
    const fw = String.fromCharCode(0x3000) // 全形空白
    expect(normalizeQuestion(`  Hello${fw}World ？`)).toBe('hello world')
    expect(normalizeQuestion('你好嗎？')).toBe('你好嗎')
  })
})

describe('cacheable 用途隔離', () => {
  it('agent_chat / design_vision 不可快取（跨 space 外洩風險）', () => {
    expect(isCacheable('agent_chat')).toBe(false)
    expect(isCacheable('design_vision_deep')).toBe(false)
    expect(isCacheable('weekly_recap')).toBe(false)
  })
  it('greeting / daily_prompt 可快取', () => {
    expect(isCacheable('greeting')).toBe(true)
    expect(isCacheable('daily_prompt')).toBe(true)
  })
})

describe('DEFAULT_CANDIDATES 完整性', () => {
  it('每個 usage key 都有至少一個候選', () => {
    for (const key of AI_USAGE_KEYS) {
      expect(DEFAULT_CANDIDATES[key].length, key).toBeGreaterThan(0)
      expect(DEFAULT_CANDIDATES[key][0]!.role, key).toBe('primary')
    }
  })
  it('每個候選 model 都帶明確 provider 前綴', () => {
    for (const key of AI_USAGE_KEYS) {
      for (const c of DEFAULT_CANDIDATES[key]) {
        expect(splitProviderPrefix(c.model).provider, `${key}: ${c.model}`).toBeDefined()
      }
    }
  })
})
