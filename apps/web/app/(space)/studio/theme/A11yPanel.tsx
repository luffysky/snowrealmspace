'use client'

import { useState } from 'react'
import type { A11yReport, ContrastPair } from '@snowrealm/theme-engine'

/**
 * 對比檢查面板。ADR-011。
 *
 * 關鍵設計：**不能只顯示紅色叉叉。**
 * 那等於告訴使用者「你錯了」卻不說怎麼改。
 * 每個不合格項都附上具體的修改方向與差距數字。
 *
 * 另外：不合格**不阻止儲存**。這是使用者的空間，
 * 我們提供資訊而非家長式管制；但套用時功能性元素會自動 fallback。
 *
 * 刻意不用 role="status" / role="alert"：這是持續存在的內容，不是事件通知。
 * 設成 live region 的話，使用者每打一個色碼字元都會被朗讀一次整份報告。
 */
export function A11yPanel({
  report,
  suggestFix,
}: {
  report: A11yReport
  suggestFix: (pair: ContrastPair) => string | null
}) {
  const [expanded, setExpanded] = useState(false)

  const failing = report.pairs.filter((p) => !p.advisory && p.level === 'fail')
  const advisories = report.pairs.filter((p) => p.advisory && p.level === 'fail')

  return (
    <section className="sr-card">
      <h2 className="sr-section-title">可讀性</h2>

      {report.passesAA ? (
        <p className="sr-message sr-message-success">
          ✓ 所有文字組合都達到 WCAG AA。最低對比 {report.worstRatio}:1。
        </p>
      ) : (
        <div className="sr-message sr-message-error">
          <p style={{ margin: 0, fontWeight: 600 }}>
            ✕ 有 {failing.length} 組對比不足
          </p>
          <ul style={{ margin: 'var(--sr-space-2) 0 0', paddingLeft: '1.2em' }}>
            {failing.map((p) => (
              <li key={p.label}>
                <strong>{p.label}</strong>
                <br />
                {suggestFix(p)}
              </li>
            ))}
          </ul>
          <p className="sr-muted" style={{ marginBottom: 0, marginTop: 'var(--sr-space-3)' }}>
            仍然可以儲存。套用時，Focus 外框與錯誤訊息會自動改用高對比顏色，
            確保鍵盤操作與錯誤提示不會看不見。
          </p>
        </div>
      )}

      {advisories.length > 0 && (
        <p className="sr-message sr-message-info">
          ⓘ {advisories.map((a) => a.label).join('、')} 對比偏低。
          這屬於裝飾性元素，不影響可用性，僅供參考。
        </p>
      )}

      <button
        type="button"
        className="sr-button sr-button-secondary"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        style={{ marginTop: 'var(--sr-space-3)' }}
      >
        {expanded ? '收起完整報告' : `查看完整報告（${report.pairs.length} 組）`}
      </button>

      {expanded && (
        <table className="sr-table">
          <caption className="sr-visually-hidden">所有顏色組合的對比檢查結果</caption>
          <thead>
            <tr>
              <th scope="col">組合</th>
              <th scope="col">對比</th>
              <th scope="col">需要</th>
              <th scope="col">結果</th>
            </tr>
          </thead>
          <tbody>
            {report.pairs.map((p) => (
              <tr key={p.label}>
                <th scope="row" style={{ fontWeight: 400, textAlign: 'left' }}>
                  {p.label}
                  {p.advisory && <span className="sr-muted">（參考）</span>}
                </th>
                <td>{p.ratio}:1</td>
                <td>{p.required}:1</td>
                <td>
                  {/* 不以顏色作為唯一訊息（v1.0 §43）—— 文字本身就說明結果 */}
                  {p.level === 'fail' ? '✕ 不足' : p.level === 'AAA' ? '✓ AAA' : '✓ AA'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
