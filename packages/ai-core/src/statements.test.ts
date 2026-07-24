import { describe, it, expect } from 'vitest'
import {
  clampStatement,
  clampStatements,
  InvalidStatementError,
  type Statement,
} from './statements.js'

function stmt(over: Partial<Statement>): Statement {
  return {
    category: 'inference',
    text: 't',
    evidence: { sourceIds: ['a1'] },
    confidence: 0.5,
    ...over,
  }
}

describe('clampStatement — §11 驗收', () => {
  it('metric 必須有 sourceIds、confidence 恆 1.0', () => {
    const r = clampStatement(stmt({ category: 'metric', confidence: 0.3 }))
    expect(r.confidence).toBe(1.0)
    expect(r.evidence.sourceIds.length).toBeGreaterThan(0)
  })

  it('inference confidence=0.95 → 夾到 0.85', () => {
    expect(clampStatement(stmt({ category: 'inference', confidence: 0.95 })).confidence).toBe(0.85)
  })

  it('無證據的 fact → 丟棄（拋 InvalidStatementError）', () => {
    expect(() =>
      clampStatement(stmt({ category: 'fact', evidence: { sourceIds: [] } })),
    ).toThrow(InvalidStatementError)
  })

  it('無證據的 inference → 丟棄', () => {
    expect(() => clampStatement(stmt({ evidence: { sourceIds: [] } }))).toThrow(InvalidStatementError)
  })

  it('suggestion 可無證據、confidence < 1', () => {
    const r = clampStatement(stmt({ category: 'suggestion', evidence: { sourceIds: [] }, confidence: 1.0 }))
    expect(r.confidence).toBeLessThan(1)
  })

  it('creative confidence 為 null', () => {
    expect(clampStatement(stmt({ category: 'creative', evidence: { sourceIds: [] } })).confidence).toBeNull()
  })
})

describe('clampStatements — 丟棄無效、保留其餘', () => {
  it('無證據的 fact 被丟棄，其餘保留（不丟整個回應）', () => {
    const { kept, dropped } = clampStatements([
      stmt({ category: 'fact', evidence: { sourceIds: [] } }), // 無效
      stmt({ category: 'metric', evidence: { sourceIds: ['m1'] }, confidence: 0.2 }), // 有效
      stmt({ category: 'suggestion', evidence: { sourceIds: [] }, confidence: 0.6 }), // 有效
    ])
    expect(kept).toHaveLength(2)
    expect(dropped).toHaveLength(1)
    expect(dropped[0]!.category).toBe('fact')
    expect(kept.find((s) => s.category === 'metric')!.confidence).toBe(1.0)
  })
})
