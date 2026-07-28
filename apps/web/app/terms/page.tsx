import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicTopBar } from '@/components/PublicTopBar'

export const metadata: Metadata = { title: '使用條款 — SnowRealm-Space' }

export default function TermsPage() {
  return (
    <>
      <PublicTopBar />
      <main className="sr-legal">
      <article className="sr-card sr-stack" style={{ maxWidth: 760, margin: '0 auto' }}>
        <header>
          <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>使用條款</h1>
          <p className="sr-muted">最後更新：2026-07-29</p>
        </header>

        <p>歡迎使用 SnowRealm-Space。使用本服務即表示你同意以下條款。</p>

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
          <h2 className="sr-section-title">5. 第三方服務與整合</h2>
          <ul style={{ lineHeight: 1.9 }}>
            <li>你可選擇連接第三方服務（如 Figma／Canva 設計工具、Google／LINE 登入、天氣資料來源）。這些整合皆為<strong>選用</strong>，且受各該服務自己的條款與隱私政策約束。</li>
            <li>透過整合帶入的內容，你必須擁有合法使用權利。中斷整合時可選擇一併刪除由該工具帶進來的派生資料。</li>
            <li>我們不對第三方服務的可用性、正確性或其政策變更負責（例如天氣資訊僅供參考、外部平台變更 API）。</li>
          </ul>
        </section>

        <section className="sr-stack">
          <h2 className="sr-section-title">6. 終止與刪除</h2>
          <p>你可隨時刪除空間或帳號。若有嚴重違規，我們保留暫停帳號的權利。</p>
        </section>

        <section className="sr-stack">
          <h2 className="sr-section-title">7. 免責聲明</h2>
          <p>本服務按「現狀」提供，於法律允許範圍內不負任何明示或默示的擔保責任。請自行為重要資料另做備份。</p>
        </section>

        <p style={{ marginTop: 'var(--sr-space-4)' }}>
          <Link href="/privacy" className="sr-link">隱私政策</Link>
          {'　·　'}
          <Link href="/guide" className="sr-link">使用說明</Link>
        </p>
      </article>
    </main>
    </>
  )
}
