import Link from 'next/link'

/**
 * ADR-018：feature flag 關閉時，路由必須真的回 404 而不只是隱藏按鈕。
 * requireFlag() 呼叫 notFound() 後就落到這裡，所以這頁的文案
 * 必須同時適用於「頁面不存在」與「這個功能尚未開放」兩種情況。
 */
export default function NotFound() {
  return (
    <main className="sr-center">
      <div className="sr-card" style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'var(--sr-text-h2)', marginBottom: 'var(--sr-space-3)' }}>
          這裡什麼都沒有
        </h1>
        <p className="sr-muted" style={{ marginTop: 0, marginBottom: 'var(--sr-space-6)' }}>
          你要找的頁面不存在，或這個功能還沒開放。
        </p>
        <Link className="sr-button sr-button-secondary" href="/home">
          回到 Home
        </Link>
      </div>
    </main>
  )
}
