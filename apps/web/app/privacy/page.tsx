import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicTopBar } from '@/components/PublicTopBar'

export const metadata: Metadata = { title: '隱私政策 — SnowRealm-Space' }

/**
 * 隱私政策（公開，站台閘門豁免——Google/LINE OAuth 審核需要可公開存取）。
 * 內容誠實對應這個產品實際的行為，不是罐頭法律文。
 */
export default function PrivacyPage() {
  return (
    <>
      <PublicTopBar />
      <main className="sr-legal">
      <article className="sr-card sr-stack" style={{ maxWidth: 760, margin: '0 auto' }}>
        <header>
          <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>隱私政策</h1>
          <p className="sr-muted">最後更新：2026-07-29</p>
        </header>

        <p>
          SnowRealm-Space（以下稱「本服務」）是一個私人的數位空間。我們的原則是：
          <strong>只收必要的資料、你的資料只屬於你、你隨時能帶走或刪除。</strong>
        </p>

        <section className="sr-stack">
          <h2 className="sr-section-title">我們收集哪些資料</h2>
          <ul style={{ lineHeight: 1.9 }}>
            <li><strong>帳號</strong>：email 或使用者名稱、以及登入驗證所需資訊。若你選擇用 Google 或 LINE 登入／綁定，我們只接收辨識所需的基本識別資料（不會取用你在該平台的其他資料）。</li>
            <li><strong>你上傳的內容</strong>：圖片、影片、PDF、音訊等檔案，存於 Cloudflare R2；檔案的中繼資料（檔名、標籤、資料夾）存於資料庫。</li>
            <li><strong>你建立的內容</strong>：主題、背景、專案、作品、記憶、時間軸事件等。</li>
            <li><strong>選用功能的資料</strong>：若你主動開啟天氣（預設關閉），我們保存你設定的<strong>城市名稱</strong>；若你連接外部設計工具，我們保存加密後的授權憑證。細節見下方各段。</li>
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
          <h2 className="sr-section-title">第三方登入（Google／LINE）</h2>
          <p>
            你可以選擇用 Google 或 LINE 登入或綁定既有帳號，這是<strong>選用</strong>的。授權時我們只取得辨識你所需的基本資料
            （如你在該平台的識別碼、必要時的 email），<strong>不會</strong>取用你在那些平台的其他內容，也<strong>不會</strong>代你發文或存取通訊錄。
            你可以隨時在「設定 → 帳號」解除綁定（前提是至少保留一種登入方式）。
          </p>
        </section>

        <section className="sr-stack">
          <h2 className="sr-section-title">外部設計工具整合（Figma／Canva）</h2>
          <p>
            連接 Figma／Canva 是<strong>選用且預設未連接</strong>的。連接後：
          </p>
          <ul style={{ lineHeight: 1.9 }}>
            <li>我們以<strong>加密</strong>方式保存該平台核發的授權憑證（token），只用於你<strong>明確挑選</strong>的檔案同步——不會自動抓取你整個帳號或團隊。</li>
            <li>同步進來的預覽圖存於你的媒體庫（Cloudflare R2），與你自己上傳的檔案一樣受你控制。</li>
            <li>你可隨時在「設定 → 整合」中斷連線，並選擇一併刪除由該工具帶進來的作品與版本。</li>
          </ul>
        </section>

        <section className="sr-stack">
          <h2 className="sr-section-title">位置與天氣</h2>
          <p>
            天氣功能<strong>預設關閉</strong>，只有你主動開啟才會運作。開啟時：
          </p>
          <ul style={{ lineHeight: 1.9 }}>
            <li>我們只保存你設定的<strong>城市名稱</strong>（粗略位置），<strong>不</strong>保存精確座標。</li>
            <li>天氣是由<strong>你的瀏覽器</strong>直接向天氣資料服務（Open-Meteo）查詢——我們的伺服器只提供你設定的城市名，實際的查詢由你的瀏覽器發出（城市名與你的連線 IP 會由瀏覽器送達 Open-Meteo）。我們自己<strong>只保存城市名稱、永不保存座標</strong>。</li>
            <li>若你選擇用「使用目前位置」，你的座標<strong>只在你的瀏覽器端</strong>使用：由瀏覽器直接向地理編碼服務（BigDataCloud）換算成城市名稱後<strong>立即丟棄</strong>，座標<strong>不會</strong>送到我們的伺服器、也<strong>不</strong>保存。你也可以完全不使用定位、直接手動輸入城市（有手動輸入時以手動為準）。</li>
            <li>可隨時在「設定 → 隱私」關閉，關閉後即停止查詢並可清除已存的城市。</li>
          </ul>
        </section>

        <section className="sr-stack">
          <h2 className="sr-section-title">站台營運分析</h2>
          <p>
            為了維運（了解服務被使用的情況、排除問題），管理後台會顯示使用者的<strong>上線資訊</strong>：
            上線時間、在線時長、使用的<strong>裝置與瀏覽器</strong>、以及<strong>大致地區</strong>。
          </p>
          <ul style={{ lineHeight: 1.9 }}>
            <li>裝置與瀏覽器是從你瀏覽器送出的標準識別字串（User-Agent）判讀，<strong>不</strong>做跨站追蹤、<strong>不</strong>植入廣告 cookie。</li>
            <li>大致地區是把你的連線來源 IP <strong>當下</strong>傳給地理位置服務（如 ipapi.co）換成「國家／地區」字串後<strong>即丟棄</strong>——我們<strong>只保存換算出的地區字串與 IP 的雜湊值，不保存原始 IP</strong>。</li>
            <li>這些紀錄只有站台管理員能看，用於維運與安全，不作行銷或對外分享。</li>
          </ul>
        </section>

        <section className="sr-stack">
          <h2 className="sr-section-title">Email 通知</h2>
          <p>
            登入信與（<strong>你主動開啟的</strong>）每週回顧 email，透過寄件服務 Resend 寄送；我們只提供寄送所需的收件位址與信件內容，不作行銷用途。
          </p>
        </section>

        <section className="sr-stack">
          <h2 className="sr-section-title">我們用到的第三方服務</h2>
          <p className="sr-muted">
            這些服務各自有其隱私政策：Supabase（帳號與資料庫）、Cloudflare R2（檔案儲存）、Zeabur（部署）、
            Resend（寄信）、Open-Meteo（天氣，僅在你開啟時）、IP 地理位置服務（ipapi.co／ip-api.com／ipwho.is，僅用於把連線 IP 換成大致地區字串）、
            你主動連接的 AI 服務商與 Figma／Canva、以及你選用的 Google／LINE 登入。
            我們只在提供對應功能所需的最小範圍內與它們交換資料。
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
            <li><strong>控制選用功能</strong>：天氣、外部整合、每週回顧 email、第三方登入綁定都可隨時關閉或解除。</li>
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
    </>
  )
}
