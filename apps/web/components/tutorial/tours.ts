/**
 * 互動教學的腳本。每個步驟會導覽到對應頁面、把目標區塊打亮（其他暗化）、
 * 並顯示解說。目標用 data-tour 屬性標在實際 UI 上，選不到就跳過該步（不會卡住）。
 */
export type TourStep = {
  /** 這步要在哪個頁面。與目前不同會先導覽過去。 */
  route?: string
  /** 要打亮的元素選擇器（通常是 [data-tour="..."]）。省略＝置中解說、不打亮特定區塊。 */
  selector?: string
  title: string
  body: string
}

export type Tour = { id: string; title: string; steps: TourStep[] }

export const TOURS: Record<string, Tour> = {
  library: {
    id: 'library',
    title: '媒體庫教學',
    steps: [
      {
        route: '/library',
        selector: '[data-tour="uploader"]',
        title: '上傳檔案',
        body: '把圖片、影片、PDF 或音訊拖進這裡，或點擊選檔。大檔會在背景處理縮圖，稍等就會出現。',
      },
      {
        route: '/library',
        selector: '[data-tour="folders"]',
        title: '資料夾分類',
        body: '點「＋新增資料夾」建立分類；每個檔案的「資料夾」按鈕可以把它移進去。點資料夾就只看那一夾。',
      },
      {
        route: '/library',
        selector: '[data-tour="tag-filter"]',
        title: '標籤篩選',
        body: '給檔案加標籤後，這裡會列出用到的標籤，點一下就篩選同類的檔案。',
      },
    ],
  },
  background: {
    id: 'background',
    title: '背景教學',
    steps: [
      {
        route: '/studio/background',
        selector: '[data-tour="bg-add"]',
        title: '加入背景',
        body: '從你的圖片或影片選一個，或加入單色／漸層背景。加好會直接打開調整面板。',
      },
      {
        route: '/studio/background',
        selector: '[data-tour="bg-playlists"]',
        title: '組成幻燈片',
        body: '把多個背景組成幻燈片，設定輪播方式與轉場，空間背景就會自動切換。',
      },
    ],
  },
  theme: {
    id: 'theme',
    title: '主題教學',
    steps: [
      {
        route: '/studio/theme',
        selector: '[data-tour="theme-studio"]',
        title: '調整主題',
        body: '挑一個內建主題套用，或在這裡自己調配色與字體。也可以在媒體庫從一張圖一鍵生成主題。',
      },
    ],
  },
}

export function getTour(id: string): Tour | null {
  return TOURS[id] ?? null
}
