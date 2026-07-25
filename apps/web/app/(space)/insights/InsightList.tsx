'use client'

import { useState, useTransition } from 'react'
import type { Insight } from '@snowrealm/daily-engine/shared'
import { removeInsight } from './actions'

/** 五分類的顯示中繼（v1.0 clampStatement）。data-type 讓 CSS 上色。 */
const TYPE_META: Record<string, { label: string; icon: string }> = {
  fact: { label: '事實', icon: '📊' },
  metric: { label: '數據', icon: '📈' },
  inference: { label: '推論', icon: '🔎' },
  suggestion: { label: '建議', icon: '💡' },
  creative: { label: '創意', icon: '✨' },
}

function confidenceLabel(type: string, confidence: number): string {
  if (type === 'fact' || type === 'metric') return '數據型回顧，來自實際事件'
  if (confidence >= 0.8) return '高可信度'
  if (confidence >= 0.5) return '中等可信度'
  return '參考性推論，僅供參考'
}

/** 回顧清單。每筆都是「有根據的描述」，標明分類、附證據數與可信度。 */
export function InsightList({ initial }: { initial: Insight[] }) {
  const [items, setItems] = useState(initial)
  const [pending, startTransition] = useTransition()

  function remove(id: string) {
    const before = items
    setItems((xs) => xs.filter((i) => i.id !== id)) // 樂觀
    startTransition(async () => {
      const res = await removeInsight({ id })
      if (!res.ok) setItems(before) // 回滾
    })
  }

  if (items.length === 0) {
    return (
      <section className="sr-card sr-empty">
        <p className="sr-muted" style={{ margin: 0 }}>
          這個週期還沒有足夠的活動可以回顧。多用幾天，換個主題、上傳點東西，再回來看看。
        </p>
      </section>
    )
  }

  return (
    <div className="sr-insight-grid">
      {items.map((it) => {
        const meta = TYPE_META[it.type] ?? { label: it.type, icon: '•' }
        return (
          <article key={it.id} className="sr-card sr-insight" data-type={it.type}>
            <header className="sr-insight-head">
              <span className="sr-insight-badge" data-type={it.type}>
                <span aria-hidden="true">{meta.icon}</span> {meta.label}
              </span>
              <button
                type="button"
                className="sr-insight-del"
                aria-label="刪除這則回顧"
                onClick={() => remove(it.id)}
                disabled={pending}
              >
                ✕
              </button>
            </header>
            <strong className="sr-insight-type">{it.title}</strong>
            <p className="sr-insight-statement">{it.statement}</p>
            <footer className="sr-insight-foot sr-muted">
              <span title="這則回顧根據的真實事件數">依據 {it.evidence.sourceIds.length} 筆活動</span>
              {it.evidence.metric != null && it.evidence.value != null && (
                <span title="這則回顧的關鍵指標">
                  {it.evidence.metric}：{it.evidence.value}
                </span>
              )}
              <span className="sr-insight-conf" title={confidenceLabel(it.type, it.confidence)}>
                可信度 {Math.round(it.confidence * 100)}%
              </span>
            </footer>
          </article>
        )
      })}
    </div>
  )
}
