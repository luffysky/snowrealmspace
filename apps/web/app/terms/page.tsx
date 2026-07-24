import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: '使用條款 — SnowRealm Space' }

export default function TermsPage() {
  return (
    <main className="sr-legal">
      <article className="sr-card sr-stack" style={{ maxWidth: 760, margin: '0 auto' }}>
        <header>
          <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>使用條款</h1>
          <p className="sr-muted">最後更新：2026-07-25</p>
        </header>

        <p>歡迎使用 SnowRealm Space。使用本服務即表示你同意以下條款。</p>

        <section className="sr-stack">
          <h2 className="sr-section-title">1. 服務性質</h2>
          <p>本服務目前為<strong>邀請制的封閉測試（Alpha）</strong>，功能可能變動、暫停或重置。我們會盡力維護穩定，但不保證不中斷。</p>
        </section>

        <section className="sr-stack">
          <h2 className="sr-section-title">2. 你的帳號與內容</h2>
          <ul style={{ lineHeight: 1.9 }}>
            <li>你要為自己帳號下的活動負責，並妥善保管登入方式。</li>
            <li>你上傳與建立的內容<strong>所有權仍屬於你</strong>。你授權本服務為了提供功能（儲存、顯示、你主動啟用的 AI 分析）而處理這些內容。</li>
            <li>你必須擁有你上傳內容的合法權利，且不得上傳違法或侵權的內容。</li>
          </ul>
        </section>

        <section className="sr-stack">
          <h2 className="sr-section-title">3. 可接受的使用</h2>
          <p>請勿利用本服務進行違法行為、散布惡意程式、嘗試未授權存取他人空間，或干擾服務運作。</p>
        </section>

        <section className="sr-stack">
          <h2 className="sr-section-title">4. AI 功能</h2>
          <p>AI 產生的內容僅供參考，可能不準確。是否啟用 AI、以及據此做的決定，由你自行負責。</p>
        </section>

        <section className="sr-stack">
          <h2 className="sr-section-title">5. 終止與刪除</h2>
          <p>你可隨時刪除空間或帳號。若有嚴重違規，我們保留暫停帳號的權利。</p>
        </section>

        <section className="sr-stack">
          <h2 className="sr-section-title">6. 免責聲明</h2>
          <p>本服務按「現狀」提供，於法律允許範圍內不負任何明示或默示的擔保責任。請自行為重要資料另做備份。</p>
        </section>

        <p style={{ marginTop: 'var(--sr-space-4)' }}>
          <Link href="/privacy" className="sr-link">隱私政策</Link>
          {'　·　'}
          <Link href="/guide" className="sr-link">使用說明</Link>
        </p>
      </article>
    </main>
  )
}
