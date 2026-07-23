/** Q9：載入狀態。骨架保留與實際內容相近的高度，避免版面跳動。 */
export default function Loading() {
  return (
    <div className="sr-stack" aria-busy="true" aria-live="polite">
      <span className="sr-muted">載入中…</span>
      <div className="sr-card" style={{ minHeight: 120 }} />
      <div className="sr-card" style={{ minHeight: 160 }} />
    </div>
  )
}
