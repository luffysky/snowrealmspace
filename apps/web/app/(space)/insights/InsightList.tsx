'use client'

import { useState, useTransition } from 'react'
import type { Insight } from '@/lib/insights/engine'
import { removeInsight } from './actions'

/** 回顧清單。每筆都是「有根據的數據描述」，附證據數與可信度。 */
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
      {items.map((it) => (
        <article key={it.id} className="sr-card sr-insight">
          <header className="sr-insight-head">
            <span className="sr-insight-type">{it.title}</span>
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
          <p className="sr-insight-statement">{it.statement}</p>
          <footer className="sr-insight-foot sr-muted">
            <span title="這則回顧根據的真實事件數">依據 {it.evidence.sourceIds.length} 筆活動</span>
            <span className="sr-insight-conf" title="數據型回顧，可信度為 100%">
              可信度 {Math.round(it.confidence * 100)}%
            </span>
          </footer>
        </article>
      ))}
    </div>
  )
}
