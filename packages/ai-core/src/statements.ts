/**
 * 五分類後處理。見 docs/spec/07-agent.md §1（實作 v1.0 §21.4 / §4.4）。
 *
 * Fact/Metric/Inference 必須有證據（sourceIds），否則丟棄該條陳述（不丟整個回應）。
 * inference 的 confidence 上限 0.85 在後處理層強制，不靠 prompt 自律 ——
 * 推論永遠不該表現得跟事實一樣確定。
 */

export type StatementCategory = 'fact' | 'metric' | 'inference' | 'suggestion' | 'creative'

export type Statement = {
  category: StatementCategory
  text: string
  evidence: {
    metric?: string
    value?: number
    comparison?: number
    sourceIds: string[]
  }
  confidence: number | null
}

export const INFERENCE_MAX_CONFIDENCE = 0.85

export class InvalidStatementError extends Error {
  constructor(readonly statement: Statement) {
    super(`無效陳述：${statement.category} 缺少 sourceIds`)
    this.name = 'InvalidStatementError'
  }
}

function hasSources(s: Statement): boolean {
  return Array.isArray(s.evidence?.sourceIds) && s.evidence.sourceIds.length > 0
}

/**
 * 規範化單一陳述。無證據的 fact/metric/inference → 拋 InvalidStatementError。
 * fact/metric confidence 恆 1.0；inference 夾到 ≤ 0.85；creative confidence 為 null。
 */
export function clampStatement(s: Statement): Statement {
  if (s.category === 'fact' || s.category === 'metric') {
    if (!hasSources(s)) throw new InvalidStatementError(s)
    return { ...s, confidence: 1.0 }
  }
  if (s.category === 'inference') {
    if (!hasSources(s)) throw new InvalidStatementError(s)
    return { ...s, confidence: Math.min(s.confidence ?? 0.5, INFERENCE_MAX_CONFIDENCE) }
  }
  if (s.category === 'creative') {
    return { ...s, confidence: null }
  }
  // suggestion：可空證據，confidence < 1.0（若給了 1.0 就夾一點）
  return { ...s, confidence: Math.min(s.confidence ?? 0.5, 0.99) }
}

/**
 * 批次處理：丟棄無效陳述、保留其餘（§1「丟棄該條，不丟整個回應」）。
 * 回傳 kept + dropped（dropped 供寫入 ai_usage_log.error 分析用）。
 */
export function clampStatements(statements: Statement[]): {
  kept: Statement[]
  dropped: Statement[]
} {
  const kept: Statement[] = []
  const dropped: Statement[] = []
  for (const s of statements) {
    try {
      kept.push(clampStatement(s))
    } catch (e) {
      if (e instanceof InvalidStatementError) dropped.push(s)
      else throw e
    }
  }
  return { kept, dropped }
}
