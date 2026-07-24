import { describe, it, expect } from 'vitest'
import {
  AGENT_TOOLS,
  assertNoForbiddenTools,
  getToolByName,
  needsConfirmation,
  toProviderTools,
  FORBIDDEN_TOOL_PATTERNS,
} from './agent-tools.js'

describe('AGENT_TOOLS 註冊表', () => {
  it('恰好 10 個 tool', () => {
    expect(AGENT_TOOLS).toHaveLength(10)
  })
  it('每個 tool 都有 name/description/inputSchema/permission/auditAction', () => {
    for (const t of AGENT_TOOLS) {
      expect(t.name, t.name).toBeTruthy()
      expect(t.description.length, t.name).toBeGreaterThan(0)
      expect(t.inputSchema, t.name).toBeTruthy()
      expect(t.permission, t.name).toBeTruthy()
      expect(t.auditAction, t.name).toMatch(/^agent\./)
    }
  })
  it('tool 名稱不重複', () => {
    const names = AGENT_TOOLS.map((t) => t.name)
    expect(new Set(names).size).toBe(names.length)
  })
  it('inputSchema 都是 additionalProperties:false（不接受未定義欄位）', () => {
    for (const t of AGENT_TOOLS) {
      expect((t.inputSchema as { additionalProperties?: boolean }).additionalProperties, t.name).toBe(false)
    }
  })
})

describe('規則 8：Agent 無刪除/封存/分享/上傳能力', () => {
  it('assertNoForbiddenTools 通過（結構保證）', () => {
    expect(() => assertNoForbiddenTools()).not.toThrow()
  })
  it('沒有任何 tool 名稱含 delete/archive/share/upload/disconnect', () => {
    const names = AGENT_TOOLS.map((t) => t.name.toLowerCase())
    for (const n of names) {
      for (const pat of FORBIDDEN_TOOL_PATTERNS) expect(pat.test(n), n).toBe(false)
    }
  })
  it('植入禁止 tool 會被 assertNoForbiddenTools 抓到（變異測試）', () => {
    expect(() =>
      assertNoForbiddenTools([
        {
          name: 'delete_asset',
          description: 'x',
          inputSchema: {},
          permission: 'assets:tag',
          requiresConfirmation: true,
          auditAction: 'agent.x',
          undoable: false,
        },
      ]),
    ).toThrow(/規則 8/)
  })
})

describe('確認策略', () => {
  it('apply_theme 靜態需確認', () => {
    expect(getToolByName('apply_theme')!.requiresConfirmation).toBe(true)
    expect(needsConfirmation('apply_theme', { themeId: 'x' })).toBe(true)
  })
  it('tag_asset：<3 且 add → 不需確認', () => {
    expect(needsConfirmation('tag_asset', { assetIds: ['a', 'b'], tags: ['t'], mode: 'add' })).toBe(false)
  })
  it('tag_asset：≥3 個 → 需確認', () => {
    expect(needsConfirmation('tag_asset', { assetIds: ['a', 'b', 'c'], tags: ['t'] })).toBe(true)
  })
  it('tag_asset：mode=replace → 需確認', () => {
    expect(needsConfirmation('tag_asset', { assetIds: ['a'], tags: ['t'], mode: 'replace' })).toBe(true)
  })
  it('create_note 不需確認', () => {
    expect(needsConfirmation('create_note', { body: 'x' })).toBe(false)
  })
  it('未知 tool 保守要求確認', () => {
    expect(needsConfirmation('unknown_tool', {})).toBe(true)
  })
})

describe('toProviderTools', () => {
  it('映射成 callAI 的 ToolDefinition（name/description/parameters）', () => {
    const pts = toProviderTools()
    expect(pts).toHaveLength(10)
    expect(pts[0]).toHaveProperty('parameters')
    expect(pts[0]!.name).toBe(AGENT_TOOLS[0]!.name)
  })
})
