import { describe, it, expect } from 'vitest'
import {
  AGENT_SYSTEM_PREFIX,
  renderContextSuffix,
  buildAgentSystemPrompt,
  type AgentContext,
} from './agent-prompt.js'
import { PROMPT_CACHE_MARKER } from './providers.js'

function ctx(over: Partial<AgentContext> = {}): AgentContext {
  return {
    localTime: '2026-07-24 10:00',
    timezone: 'Asia/Taipei',
    spaceName: 'Nami',
    currentRoute: '/home',
    memoryEnabled: true,
    ...over,
  }
}

describe('AGENT_SYSTEM_PREFIX', () => {
  it('含五分類與反幻覺核心規則', () => {
    expect(AGENT_SYSTEM_PREFIX).toContain('fact')
    expect(AGENT_SYSTEM_PREFIX).toContain('inference')
    expect(AGENT_SYSTEM_PREFIX).toContain('不要假裝看過沒看過的東西')
    expect(AGENT_SYSTEM_PREFIX).toContain('你不得自行計算任何數值')
  })
})

describe('renderContextSuffix — 反幻覺分支', () => {
  it('圖片未附上 → 明確禁止描述畫面內容', () => {
    const s = renderContextSuffix(
      ctx({
        selectedSnapshot: {
          title: '海報',
          createdAt: '2026-07-01',
          localFeatures: { dominant: '#8c5870' },
          imageAttached: false,
        },
      }),
    )
    expect(s).toContain('不得描述畫面內容')
    expect(s).not.toContain('你可以直接觀察它')
  })

  it('圖片已附上 → 允許觀察', () => {
    const s = renderContextSuffix(
      ctx({
        selectedSnapshot: {
          title: '海報',
          createdAt: '2026-07-01',
          localFeatures: { dominant: '#8c5870' },
          imageAttached: true,
        },
      }),
    )
    expect(s).toContain('你可以直接觀察它')
  })

  it('本地分析攤平成可引用的行', () => {
    const s = renderContextSuffix(
      ctx({
        selectedSnapshot: {
          title: 'x',
          createdAt: 'd',
          localFeatures: { colorCount: 5, whitespaceRatio: 0.3 },
          imageAttached: true,
        },
      }),
    )
    expect(s).toContain('colorCount：5')
    expect(s).toContain('whitespaceRatio：0.3')
  })
})

describe('renderContextSuffix — 記憶開關', () => {
  it('記憶關閉 → 明確禁止提議/引用，且不列記憶', () => {
    const s = renderContextSuffix(ctx({ memoryEnabled: false, memories: ['不該出現'] }))
    expect(s).toContain('記憶功能目前為關閉狀態')
    expect(s).not.toContain('不該出現')
  })
  it('記憶開啟且有記憶 → 列出', () => {
    const s = renderContextSuffix(ctx({ memoryEnabled: true, memories: ['喜歡暖色'] }))
    expect(s).toContain('喜歡暖色')
  })
})

describe('buildAgentSystemPrompt', () => {
  it('前綴 + cache 標記 + 後綴', () => {
    const p = buildAgentSystemPrompt(ctx())
    expect(p.startsWith(AGENT_SYSTEM_PREFIX)).toBe(true)
    expect(p).toContain(PROMPT_CACHE_MARKER)
    expect(p).toContain('當前脈絡')
  })
})
