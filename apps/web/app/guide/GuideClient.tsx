'use client'

import { useState } from 'react'
import Link from 'next/link'
import { startTutorial } from '@/components/tutorial/TutorialController'

type Section = {
  key: string
  label: string
  intro: string
  steps: { title: string; body: string }[]
  /** 有互動教學可導覽的話，帶入該教學 id。 */
  tour?: string
}

const SECTIONS: Section[] = [
  {
    key: 'library',
    label: '媒體庫',
    intro: '所有圖片、影片、PDF、音訊都放在媒體庫，可用資料夾與標籤整理。',
    tour: 'library',
    steps: [
      { title: '上傳', body: '把檔案拖進上傳區，或點擊選檔。大檔會在背景處理縮圖，稍等就會出現。' },
      { title: '資料夾', body: '用「＋新增資料夾」把檔案分類；每個檔案的「資料夾」按鈕可把它移進資料夾。' },
      { title: '標籤', body: '給檔案加標籤後，點標籤 chip 就能快速篩選同類的檔案。' },
      { title: '設為作品／生成主題', body: '圖片可「設為作品」做版本比較，或直接從圖片一鍵生成配色主題。' },
    ],
  },
  {
    key: 'background',
    label: '背景',
    intro: '在 Background Studio 把圖片/影片變成背景，加漸層、霧面玻璃、裁切，還能組成會輪播的幻燈片。',
    tour: 'background',
    steps: [
      { title: '加背景', body: '從你的圖片或影片選一個，或加入單色／漸層背景。' },
      { title: '調整', body: '調位置、縮放、模糊、疊色、霧面玻璃；圖片可勾「裁切」拖框選範圍。' },
      { title: '幻燈片', body: '把多個背景組成幻燈片，設定輪播方式與轉場，會自動切換。' },
    ],
  },
  {
    key: 'theme',
    label: '主題與外觀',
    intro: '主題決定整個空間的配色與字體。可自訂、從圖片生成，或切換深淺色。',
    tour: 'theme',
    steps: [
      { title: '選主題', body: '從內建主題挑一個套用，或在主題工作室自己調色。' },
      { title: '從圖片生成', body: '在媒體庫選一張圖，一鍵生成協調的配色主題。' },
      { title: '深淺色', body: '導覽列的日／月按鈕可切換深淺色，系統會記住你的選擇。' },
    ],
  },
  {
    key: 'home',
    label: '首頁與每日',
    intro: '首頁是可自由排版的儀表板，每天還有問候、語錄、驚喜盒。',
    tour: 'home',
    steps: [
      { title: '排版', body: '進編輯模式可拖曳、縮放小工具，排成你喜歡的樣子（拖曳會跟著游標）。' },
      { title: '每日卡片', body: '每天會有問候與語錄；打開驚喜盒可能開到稀有的收藏。' },
    ],
  },
  {
    key: 'timeline',
    label: '時間軸',
    intro: '你在空間裡的重要動作會投影成時間軸。',
    tour: 'timeline',
    steps: [
      { title: '檢視', body: '可切換不同檢視（依時間、當日回顧…）。' },
      { title: '整理', body: '每一筆都能隱藏或刪除。' },
    ],
  },
  {
    key: 'projects',
    label: '專案',
    intro: '把相關作品收進專案一起管理。',
    tour: 'projects',
    steps: [
      { title: '建立', body: '建專案、改狀態、加標籤、設封面。' },
      { title: '刪除', body: '刪專案不會刪作品，只解除歸屬。' },
    ],
  },
  {
    key: 'integrations',
    label: '外部整合',
    intro: '把 Figma／Canva 的設計檔同步進媒體庫，做版本比較。整合預設未連接，完全由你決定。',
    steps: [
      { title: '連接', body: '到「設定 → 整合」連接 Figma 或 Canva（會導去該平台授權，授權憑證加密保存）。' },
      { title: '選檔同步', body: '連好後按「選擇檔案同步」，勾選要帶進來的檔案（不會自動抓整個帳號）。Figma 需填專案 ID。' },
      { title: '看版本', body: '同步的檔案會出現在「作品庫」，可對版本做並排／疊圖／滑桿比較。' },
      { title: '中斷', body: '隨時可在整合頁中斷連線，並選擇是否一併刪除帶進來的作品與版本。' },
    ],
  },
  {
    key: 'weather',
    label: '天氣',
    intro: '在首頁放一個天氣小工具，顯示你所在城市的目前天氣。預設關閉，只存城市名稱、不記錄座標。',
    steps: [
      { title: '開啟', body: '到「設定 → 天氣」勾選「顯示天氣」。這功能預設是關的。' },
      { title: '設定城市', body: '輸入城市名稱，或按「使用目前位置」讓瀏覽器定位並自動填入（可拒絕，改用手動輸入）。' },
      { title: '加到首頁', body: '在首頁編輯模式新增「天氣」小工具，會顯示日／夜、氣溫、地區與對應天氣動畫。' },
      { title: '動畫', body: '可在小工具設定關閉動畫；開啟省流量或減少動態偏好時，系統會自動改為靜態顯示。' },
    ],
  },
  {
    key: 'ai',
    label: 'AI 與記憶',
    intro: 'AI 助理與記憶預設關閉，完全由你決定要不要開。',
    tour: 'agent',
    steps: [
      { title: '開啟', body: '到「設定 → 隱私」開啟 AI 分析或記憶。' },
      { title: '對話', body: '在 Agent 頁與助理對話；它只看得到你當次提供的內容。' },
      { title: '記憶', body: '助理提出的記憶要你按同意才會保存，標為「限制」的永不進入對話。' },
    ],
  },
]

export function GuideClient() {
  const [active, setActive] = useState(SECTIONS[0]!.key)
  const section = SECTIONS.find((s) => s.key === active) ?? SECTIONS[0]!

  return (
    <div className="sr-stack">
      <section>
        <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>使用說明</h1>
        <p className="sr-muted">分區介紹各功能。想邊看邊操作，點各區的「互動教學」，畫面會帶你走一遍。</p>
      </section>

      {/* 分區 tab */}
      <div className="sr-chip-row" role="tablist" aria-label="使用說明分區">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={active === s.key}
            className={`sr-chip${active === s.key ? ' sr-chip-active' : ''}`}
            onClick={() => setActive(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <section className="sr-card sr-stack" role="tabpanel">
        <div className="sr-row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 className="sr-section-title" style={{ marginBottom: 0 }}>
            {section.label}
          </h2>
          {section.tour && (
            <button type="button" className="sr-button" onClick={() => startTutorial(section.tour!)}>
              ▶ 互動教學
            </button>
          )}
        </div>
        <p className="sr-muted">{section.intro}</p>
        <ol className="sr-stack" style={{ paddingLeft: 'var(--sr-space-4)', lineHeight: 1.9 }}>
          {section.steps.map((st) => (
            <li key={st.title}>
              <strong>{st.title}</strong>：{st.body}
            </li>
          ))}
        </ol>
      </section>

      <p className="sr-muted">
        另見 <Link href="/privacy" className="sr-link">隱私政策</Link> 與{' '}
        <Link href="/terms" className="sr-link">使用條款</Link>。
      </p>
    </div>
  )
}
