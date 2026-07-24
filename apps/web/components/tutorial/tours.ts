/**
 * 互動教學腳本。每步導覽到對應頁、把目標區塊打亮（其他暗化）、顯示解說。
 * 目標用 data-tour 屬性標在實際 UI；選不到就退化成置中解說，不會卡住。
 */
export type TourStep = {
  route?: string
  selector?: string
  title: string
  body: string
}

export type Tour = { id: string; title: string; steps: TourStep[] }

export const TOURS: Record<string, Tour> = {
  home: {
    id: 'home',
    title: '首頁教學',
    steps: [
      { route: '/home', selector: '[data-tour="home-grid"]', title: '你的儀表板', body: '首頁是可自由排版的儀表板。進「編輯版面」可拖曳、縮放小工具，排成你喜歡的樣子（拖曳會跟著游標）。' },
      { route: '/home', selector: '[data-tour="home-grid"]', title: '每日內容', body: '每天會有問候與語錄；打開驚喜盒可能開到稀有的收藏。' },
      { selector: '[data-tour="nav"]', title: '各區入口', body: '上方導覽列可到媒體庫、背景、主題、時間軸、Agent 等。右邊有通知鈴鐺與日/月（深淺色）切換。' },
    ],
  },
  library: {
    id: 'library',
    title: '媒體庫教學',
    steps: [
      { route: '/library', selector: '[data-tour="uploader"]', title: '上傳檔案', body: '把圖片、影片、PDF、音訊拖進這裡或點擊選檔。大檔會在背景處理縮圖，稍等就會出現。' },
      { route: '/library', selector: '[data-tour="folders"]', title: '資料夾', body: '用「＋新增資料夾」分類；每個檔案的「資料夾」按鈕可把它移進去。點資料夾就只看那一夾。' },
      { route: '/library', selector: '[data-tour="tag-filter"]', title: '標籤', body: '給檔案加標籤後，這裡列出用到的標籤，點一下就篩選同類檔案。' },
      { route: '/library', selector: '[data-tour="uploader"]', title: '從圖生成主題 / 設為作品', body: '圖片可「設為作品」做版本比較，或一鍵從圖片生成配色主題。' },
    ],
  },
  background: {
    id: 'background',
    title: '背景教學',
    steps: [
      { route: '/studio/background', selector: '[data-tour="bg-add"]', title: '加入背景', body: '從你的圖片/影片選一個，或加入單色/漸層背景，甚至內建動態場景（雪/雨/櫻花…）。' },
      { route: '/studio/background', selector: '[data-tour="bg-add"]', title: '漸層與場景', body: '漸層可線性/放射/多點網狀（點選位置一點一色）；動態場景還能「疊加」在圖片上、調密度。' },
      { route: '/studio/background', selector: '[data-tour="bg-playlists"]', title: '幻燈片', body: '把多個背景組成幻燈片，設定輪播與轉場，啟用後背景會即時切換。' },
    ],
  },
  theme: {
    id: 'theme',
    title: '主題教學',
    steps: [
      { route: '/studio/theme', selector: '[data-tour="theme-studio"]', title: '調整主題', body: '挑內建主題套用，或自己調配色與字體。也可以在媒體庫從一張圖一鍵生成主題。' },
      { selector: '[data-tour="theme-toggle"]', title: '深淺色', body: '導覽列的日/月按鈕切換深淺色，系統會自動幫任何主題算出協調的暗色版並記住你的選擇。' },
    ],
  },
  timeline: {
    id: 'timeline',
    title: '時間軸教學',
    steps: [
      { route: '/timeline', selector: '[data-tour="timeline"]', title: '你的時間軸', body: '你在空間裡的重要動作（新增作品、套主題…）會投影成時間軸。可切換檢視、隱藏或刪除每一筆。' },
    ],
  },
  projects: {
    id: 'projects',
    title: '專案教學',
    steps: [
      { route: '/projects', selector: '[data-tour="projects"]', title: '專案', body: '把相關作品收進專案管理：建立、改狀態、加標籤、設封面。刪專案不會刪作品，只解除歸屬。' },
    ],
  },
  agent: {
    id: 'agent',
    title: 'AI 夥伴教學',
    steps: [
      { route: '/settings', selector: '[data-tour="privacy-toggles"]', title: '先開啟 AI', body: 'AI 與記憶預設關閉。到這裡開啟後才會運作——完全由你決定。' },
      { route: '/agent', selector: '[data-tour="agent-chat"]', title: '對話', body: '在這裡與 AI 夥伴對話。它只看得到你當次提供的內容，不會偷讀其他檔案；記憶要你同意才會保存。' },
    ],
  },
}

export function getTour(id: string): Tour | null {
  return TOURS[id] ?? null
}

/** 給使用說明頁分 tab 用：每個區塊的 id 與標題。 */
export const TOUR_LIST = Object.values(TOURS).map((t) => ({ id: t.id, title: t.title }))
