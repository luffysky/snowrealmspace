import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: '隱私政策 — SnowRealm Space' }

/**
 * 隱私政策（公開，站台閘門豁免——Google/LINE OAuth 審核需要可公開存取）。
 * 內容誠實對應這個產品實際的行為，不是罐頭法律文。
 */
export default function PrivacyPage() {
  return (
    <main className="sr-legal">
      <article className="sr-card sr-stack" style={{ maxWidth: 760, margin: '0 auto' }}>
        <header>
          <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>隱私政策</h1>
          <p className="sr-muted">最後更新：2026-07-25</p>
        </header>

        <p>
          SnowRealm Space（以下稱「本服務」）是一個私人的數位空間。我們的原則是：
          <strong>只收必要的資料、你的資料只屬於你、你隨時能帶走或刪除。</strong>
        </p>

        <section className="sr-stack">
          <h2 className="sr-section-title">我們收集哪些資料</h2>
          <ul style={{ lineHeight: 1.9 }}>
            <li><strong>帳號</strong>：email 或使用者名稱、以及登入驗證所需資訊。</li>
            <li><strong>你上傳的內容</strong>：圖片、影片、PDF、音訊等檔案，存於 Cloudflare R2；檔案的中繼資料（檔名、標籤、資料夾）存於資料庫。</li>
            <li><strong>你建立的內容</strong>：主題、背景、專案、作品、記憶、時間軸事件等。</li>
            <li><strong>使用紀錄</strong>：為了維運與安全所需的操作事件與稽核紀錄；IP 以雜湊儲存，不存明文。</li>
          </ul>
        </section>

        <section className="sr-stack">
          <h2 className="sr-section-title">AI 功能</h2>
          <p>
            AI 分析與記憶<strong>預設關閉</strong>，只有你主動開啟才會運作。送往 AI 服務商的只有該次任務所需的文字或圖片，
            <strong>不含</strong>你的金鑰或其他空間的內容；跨空間<strong>永不共用</strong>非公開的 AI 快取。詳見設定裡的「AI 資料聲明」。
          </p>
        </section>

        <section className="sr-stack">
          <h2 className="sr-section-title">Cookie</h2>
          <p>我們只使用必要的 cookie：</p>
          <ul style={{ lineHeight: 1.9 }}>
            <li><strong>登入工作階段</strong>：讓你保持登入。</li>
            <li><strong>站台閘門</strong>：目前為封閉測試，用來記住你已通過進站。</li>
            <li><strong>介面偏好</strong>：例如深淺色模式，記在你的瀏覽器。</li>
          </ul>
          <p className="sr-muted">我們不使用第三方廣告或追蹤 cookie。</p>
        </section>

        <section className="sr-stack">
          <h2 className="sr-section-title">你的權利</h2>
          <ul style={{ lineHeight: 1.9 }}>
            <li><strong>帶走</strong>：在「設定 → 資料地圖」可匯出你的資料。</li>
            <li><strong>刪除</strong>：可逐項刪除，也可刪除整個空間（7 天寬限可還原）或整個帳號（立即且不可逆）。</li>
            <li><strong>控制 AI</strong>：AI 與記憶可隨時開關；記憶只有你按同意才會保存。</li>
          </ul>
        </section>

        <section className="sr-stack">
          <h2 className="sr-section-title">聯絡</h2>
          <p>有隱私相關問題，可透過 <a className="sr-link" href="mailto:service@snowrealm.pet">service@snowrealm.pet</a> 與我們聯絡。</p>
        </section>

        <p style={{ marginTop: 'var(--sr-space-4)' }}>
          <Link href="/terms" className="sr-link">使用條款</Link>
          {'　·　'}
          <Link href="/guide" className="sr-link">使用說明</Link>
        </p>
      </article>
    </main>
  )
}
