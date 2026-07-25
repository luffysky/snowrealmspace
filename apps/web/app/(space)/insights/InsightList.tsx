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
export function InsightList({ initial, spaceId }: { initial: Insight[]; spaceId: string }) {
  const [items, setItems] = useState(initial)
  const [pending, startTransition] = useTransition()
  const [aiBusy, setAiBusy] = useState(false)
  const [aiMsg, setAiMsg] = useState<string | null>(null)

  async function generate() {
    setAiBusy(true)
    setAiMsg(null)
    try {
      const res = await fetch('/api/insights/generate', { method: 'POST', headers: { 'x-space-id': spaceId } })
      const body = (await res.json().catch(() => null)) as { data?: { added?: number; message?: string }; error?: { message?: string } } | null
      if (!res.ok) {
        setAiMsg(body?.error?.message ?? 'AI 生成失敗。')
        return
      }
      const added = body?.data?.added ?? 0
      if (added > 0) {
        window.location.reload() // 取回含新建議的完整清單
      } else {
        setAiMsg(body?.data?.message ?? 'AI 這次沒有新的建議。')
      }
    } catch {
      setAiMsg('網路錯誤，請重試。')
    } finally {
      setAiBusy(false)
    }
  }

  function remove(id: string) {
    const before = items
    setItems((xs) => xs.filter((i) => i.id !== id)) // 樂觀
    startTransition(async () => {
      const res = await removeInsight({ id })
      if (!res.ok) setItems(before) // 回滾
    })
  }

  const toolbar = (
    <div className="sr-row" style={{ justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', marginBottom: 'var(--sr-space-3)' }}>
      {aiMsg && <span className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)' }}>{aiMsg}</span>}
      <button type="button" className="sr-button sr-button-secondary" onClick={() => void generate()} disabled={aiBusy}>
        {aiBusy ? 'AI 想想…' : '✨ AI 深入回顧'}
      </button>
    </div>
  )

  if (items.length === 0) {
    return (
      <div>
        {toolbar}
        <section className="sr-card sr-empty">
          <p className="sr-muted" style={{ margin: 0 }}>
            這個週期還沒有足夠的活動可以回顧。多用幾天，換個主題、上傳點東西，再回來看看。
          </p>
        </section>
      </div>
    )
  }

  return (
    <div>
      {toolbar}
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
    </div>
  )
}
