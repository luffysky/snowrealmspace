import Link from 'next/link'

/**
 * 404。
 *
 * ADR-018：feature flag 關閉時，路由必須真的回 404 而不只是隱藏按鈕。
 * requireFlag() 呼叫 notFound() 後就落到這裡，所以文案要同時適用
 * 「頁面不存在」與「這個功能尚未開放」兩種情況。
 */
export default function NotFound() {
  return (
    <main className="sr-center">
      <div
        className="sr-card"
        style={{ maxWidth: 460, width: '100%', textAlign: 'center', padding: 'var(--sr-space-8) var(--sr-space-6)' }}
      >
        <div className="sr-404-code" aria-hidden="true">
          4<span className="sr-404-flake">❄</span>4
        </div>

        <h1 style={{ fontSize: 'var(--sr-text-h2)', margin: 'var(--sr-space-4) 0 var(--sr-space-2)' }}>
          這片雪地上什麼都沒有
        </h1>
        <p className="sr-muted" style={{ marginTop: 0, marginBottom: 'var(--sr-space-6)' }}>
          你要找的頁面不存在，或這個功能還沒開放 —— 也許它還在下雪、還沒長出來。
        </p>

        <div className="sr-row" style={{ justifyContent: 'center', gap: 'var(--sr-space-2)', flexWrap: 'wrap' }}>
          <Link className="sr-button" href="/home">
            回到首頁
          </Link>
          <Link className="sr-button sr-button-secondary" href="/login">
            回登入
          </Link>
        </div>
      </div>
    </main>
  )
}
