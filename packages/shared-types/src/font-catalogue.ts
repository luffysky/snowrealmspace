/**
 * 字體目錄。實作 ADR-016，並依使用者要求擴充繁體中文選項。
 *
 * ## 唯一的收錄標準
 *
 * **開源、免費、可商用，且授權允許 web 嵌入與子集化。**
 * 實務上這代表 SIL Open Font License 1.1 或 Apache 2.0。
 *
 * OFL 有兩點必須遵守，程式碼裡有對應機制：
 *   1. 必須隨字體散布授權全文 → `licenseFile`，`scripts/build-fonts.ts`
 *      會把 OFL.txt 一併上傳，缺檔就中止
 *   2. 衍生字體（子集化算衍生）不可用原始的 Reserved Font Name
 *      → `reservedFontName` 標記出有 RFN 的字體，子集產物一律用
 *      `slug` 當內部名稱，不宣稱是原字體
 *
 * ## 為什麼不用 Google Fonts CDN
 *
 * 那會讓每個使用者的瀏覽器對 Google 發出請求，等於把「誰在什麼時候
 * 開了這個空間」洩漏給第三方。這個產品的前提是私人空間（v1.0 §2），
 * 所以字體自架在 R2。
 */

export type FontCategory = 'sans' | 'serif' | 'display' | 'handwriting' | 'mono'

/** 這個字體實際涵蓋哪些書寫系統。決定它能被指派到哪個角色。 */
export type FontScript = 'zh-Hant' | 'latin' | 'bopomofo' | 'ja'

export type FontSource =
  /** Google Fonts 的 GitHub repo，可直接抓 TTF */
  | { kind: 'google-fonts'; repoPath: string }
  /** GitHub release 資產。zip 會自動解開。 */
  | { kind: 'github-release'; repo: string; assetPattern: string; tag?: string }
  /**
   * repo 分支中的檔案。
   * 有些字體專案把建置產物放在專用分支（例如昭源字體的 `release`），
   * 而 release 頁面只有版本說明沒有資產 —— 對這類專案 github-release 抓不到東西。
   */
  | { kind: 'github-branch'; repo: string; branch: string; path: string; filePattern: string }
  /** 直接下載連結 */
  | { kind: 'direct'; url: string }
  /** 授權允許但沒有穩定的自動下載路徑，必須人工取得 */
  | { kind: 'manual'; instructions: string }

export type FontEntry = {
  slug: string
  family: string
  /** 中文名稱。UI 上繁中字體顯示中文名比較好認。 */
  displayName: string
  category: FontCategory
  scripts: FontScript[]
  weights: number[]
  license: 'OFL-1.1' | 'Apache-2.0'
  licenseUrl: string
  /** 授權全文在 repo 中的路徑。OFL 要求隨字體散布。 */
  licenseFile: string
  /**
   * OFL 的 Reserved Font Name。有 RFN 的字體，衍生版本不可沿用原名。
   * 我們的子集產物一律用 slug 命名，所以這個欄位是給人看的提醒。
   */
  reservedFontName: string | null
  source: FontSource
  /** 系統字體 fallback。中文缺字時的最後一道，避免變成方框。 */
  fallbackStack: string
  /** 預覽用文字。繁中與拉丁字體要看的東西不同。 */
  previewText: string
  notes?: string
}

/**
 * 繁體中文字體。
 *
 * 順序刻意把「涵蓋字數多、可當內文」的放前面 ——
 * 手寫體與像素體再好看，拿來排 2000 字都是災難。
 */
export const ZH_HANT_FONTS: FontEntry[] = [
  {
    slug: 'noto-sans-tc',
    family: 'Noto Sans TC',
    displayName: '思源黑體（Noto Sans TC）',
    category: 'sans',
    scripts: ['zh-Hant', 'latin', 'bopomofo'],
    weights: [300, 400, 500, 700, 900],
    license: 'OFL-1.1',
    licenseUrl: 'https://openfontlicense.org/',
    licenseFile: 'OFL.txt',
    reservedFontName: null,
    source: { kind: 'google-fonts', repoPath: 'ofl/notosanstc' },
    fallbackStack: '"PingFang TC", "Microsoft JhengHei", sans-serif',
    previewText: '雪境是一個會隨時間長大的空間',
    notes: '字數涵蓋最完整，UI 與內文的預設。與思源黑體同源。',
  },
  {
    slug: 'noto-serif-tc',
    family: 'Noto Serif TC',
    displayName: '思源宋體（Noto Serif TC）',
    category: 'serif',
    scripts: ['zh-Hant', 'latin', 'bopomofo'],
    weights: [300, 400, 500, 700, 900],
    license: 'OFL-1.1',
    licenseUrl: 'https://openfontlicense.org/',
    licenseFile: 'OFL.txt',
    reservedFontName: null,
    source: { kind: 'google-fonts', repoPath: 'ofl/notoseriftc' },
    fallbackStack: '"Songti TC", "PMingLiU", serif',
    previewText: '雪境是一個會隨時間長大的空間',
    notes: '中文標題與長文閱讀。',
  },
  {
    slug: 'jf-open-huninn',
    family: 'jf open 粉圓',
    displayName: 'jf open 粉圓',
    category: 'sans',
    scripts: ['zh-Hant', 'latin', 'bopomofo'],
    weights: [400, 700],
    license: 'OFL-1.1',
    licenseUrl: 'https://github.com/justfont/open-huninn-font/blob/master/LICENSE',
    licenseFile: 'LICENSE',
    reservedFontName: null,
    source: {
      kind: 'github-release',
      repo: 'justfont/open-huninn-font',
      assetPattern: 'jf-openhuninn-.*\\.ttf',
    },
    fallbackStack: '"PingFang TC", sans-serif',
    previewText: '雪境是一個會隨時間長大的空間',
    notes:
      'justfont 基於 Kosugi Maru 改作，針對台灣日常用字優化，含注音與台語羅馬拼音。圓體，適合柔和的主題。',
  },
  {
    slug: 'taipei-sans-tc',
    family: 'Taipei Sans TC Beta',
    displayName: '台北黑體',
    category: 'sans',
    scripts: ['zh-Hant', 'latin', 'bopomofo'],
    weights: [300, 400, 700],
    license: 'OFL-1.1',
    licenseUrl: 'https://sites.google.com/view/jtfoundry/',
    licenseFile: 'OFL.txt',
    reservedFontName: null,
    source: {
      kind: 'manual',
      instructions:
        '翰字鑄造 JT Foundry 官網下載（https://sites.google.com/view/jtfoundry/）。' +
        '沒有穩定的直接下載網址，必須人工取得。',
    },
    fallbackStack: '"PingFang TC", sans-serif',
    previewText: '雪境是一個會隨時間長大的空間',
    notes: '基於思源黑體，字形貼近台灣教育部標準。',
  },
  {
    slug: 'chiron-hei-hk',
    family: 'Chiron Hei HK',
    displayName: '昭源黑體',
    category: 'sans',
    scripts: ['zh-Hant', 'latin'],
    weights: [300, 400, 500, 700],
    license: 'OFL-1.1',
    licenseUrl: 'https://github.com/chiron-fonts/chiron-hei-hk/blob/release/LICENSE.md',
    licenseFile: 'LICENSE.md',
    reservedFontName: null,
    source: {
      kind: 'github-branch',
      repo: 'chiron-fonts/chiron-hei-hk',
      branch: 'release',
      path: 'STATIC_TTF',
      // L=300 N=400 M=500 B=700。排除斜體（-It）—— 中文字體的斜體是
      // 機械傾斜，字形會壞掉，而且每個檔案都 14 MB。
      filePattern: '^ChironHeiHK-(L|N|M|B)\\.ttf$',
    },
    fallbackStack: '"PingFang TC", sans-serif',
    previewText: '雪境是一個會隨時間長大的空間',
    notes: '基於思源黑體改造，筆形較現代。港版字形，但繁中涵蓋完整。',
  },
  {
    slug: 'chiron-sung-hk',
    family: 'Chiron Sung HK',
    displayName: '昭源宋體',
    category: 'serif',
    scripts: ['zh-Hant', 'latin'],
    weights: [300, 400, 500, 700],
    license: 'OFL-1.1',
    licenseUrl: 'https://github.com/chiron-fonts/chiron-sung-hk/blob/release/LICENSE.md',
    licenseFile: 'LICENSE.md',
    reservedFontName: null,
    source: {
      kind: 'github-branch',
      repo: 'chiron-fonts/chiron-sung-hk',
      branch: 'release',
      path: 'STATIC_TTF',
      filePattern: '^ChironSungHK-(L|N|M|B)\\.ttf$',
    },
    fallbackStack: '"Songti TC", serif',
    previewText: '雪境是一個會隨時間長大的空間',
    notes: '宋體，筆形風格較現代。',
  },
  {
    slug: 'lxgw-wenkai-tc',
    family: 'LXGW WenKai TC',
    displayName: '霞鶩文楷',
    category: 'handwriting',
    scripts: ['zh-Hant', 'latin'],
    weights: [300, 400, 700],
    license: 'OFL-1.1',
    licenseUrl: 'https://github.com/lxgw/LxgwWenKaiTC/blob/main/OFL.txt',
    licenseFile: 'OFL.txt',
    reservedFontName: null,
    source: {
      kind: 'github-release',
      repo: 'lxgw/LxgwWenKaiTC',
      assetPattern: 'LXGWWenKaiTC-.*\\.ttf',
    },
    fallbackStack: '"Kaiti TC", "DFKai-SB", serif',
    previewText: '雪境是一個會隨時間長大的空間',
    notes: '楷體，柔和。基於 Klee One 改作。適合日記與長文。',
  },
  {
    slug: 'iansui',
    family: 'Iansui',
    displayName: '芫荽',
    category: 'handwriting',
    scripts: ['zh-Hant', 'latin', 'bopomofo'],
    weights: [400],
    license: 'OFL-1.1',
    licenseUrl: 'https://github.com/ButTaiwan/iansui/blob/main/OFL.txt',
    licenseFile: 'OFL.txt',
    reservedFontName: null,
    source: {
      // release 資產只有 iansui.zip，但 repo 裡就有現成的 ttf，直接抓比較單純
      kind: 'github-branch',
      repo: 'ButTaiwan/iansui',
      branch: 'main',
      path: 'fonts/ttf',
      filePattern: '^Iansui-.*\\.ttf$',
    },
    fallbackStack: '"Kaiti TC", serif',
    previewText: '雪境是一個會隨時間長大的空間',
    notes: '基於 Klee One 改造的台灣學習用字型，字形符合教育部標準。手寫感。',
  },
  {
    slug: 'zhuque-fangsong',
    family: 'Zhuque Fangsong',
    displayName: '朱雀仿宋',
    category: 'serif',
    scripts: ['zh-Hant', 'latin'],
    weights: [400],
    license: 'OFL-1.1',
    licenseUrl: 'https://github.com/TrionesType/zhuque/blob/main/LICENSE.txt',
    licenseFile: 'LICENSE.txt',
    reservedFontName: null,
    source: {
      kind: 'github-release',
      repo: 'TrionesType/zhuque',
      // 這個專案的版本全標為 pre-release，releases/latest 會 404，
      // 下載器會退回「列出所有 release 取第一筆」。資產是 zip，會自動解開。
      assetPattern: 'ZhuqueFangsong-.*\\.zip',
    },
    fallbackStack: '"FangSong", serif',
    previewText: '雪境是一個會隨時間長大的空間',
    notes: '仿宋。文氣重，適合引言與詩句。',
  },
]

/** 拉丁字體。與中文字體搭配時負責英數字與標點。 */
export const LATIN_FONTS: FontEntry[] = [
  {
    slug: 'inter',
    family: 'Inter',
    displayName: 'Inter',
    category: 'sans',
    scripts: ['latin'],
    weights: [400, 500, 600, 700],
    license: 'OFL-1.1',
    licenseUrl: 'https://github.com/rsms/inter/blob/master/LICENSE.txt',
    licenseFile: 'LICENSE.txt',
    reservedFontName: null,
    source: { kind: 'google-fonts', repoPath: 'ofl/inter' },
    fallbackStack: 'system-ui, sans-serif',
    previewText: 'A space that grows with you',
    notes: '介面預設。x-height 高，小字仍清楚。',
  },
  {
    slug: 'playfair-display',
    family: 'Playfair Display',
    displayName: 'Playfair Display',
    category: 'display',
    scripts: ['latin'],
    weights: [400, 500, 600, 700, 800, 900],
    license: 'OFL-1.1',
    licenseUrl: 'https://openfontlicense.org/',
    licenseFile: 'OFL.txt',
    reservedFontName: null,
    source: { kind: 'google-fonts', repoPath: 'ofl/playfairdisplay' },
    fallbackStack: 'Georgia, serif',
    previewText: 'A space that grows with you',
    notes: '高對比襯線，只適合大字標題。內文用會很難讀。',
  },
  {
    slug: 'cormorant-garamond',
    family: 'Cormorant Garamond',
    displayName: 'Cormorant Garamond',
    category: 'serif',
    scripts: ['latin'],
    weights: [300, 400, 500, 600, 700],
    license: 'OFL-1.1',
    licenseUrl: 'https://openfontlicense.org/',
    licenseFile: 'OFL.txt',
    reservedFontName: null,
    source: { kind: 'google-fonts', repoPath: 'ofl/cormorantgaramond' },
    fallbackStack: 'Garamond, Georgia, serif',
    previewText: 'A space that grows with you',
  },
  {
    slug: 'source-serif-4',
    family: 'Source Serif 4',
    displayName: 'Source Serif 4',
    category: 'serif',
    scripts: ['latin'],
    weights: [300, 400, 600, 700],
    license: 'OFL-1.1',
    licenseUrl: 'https://github.com/adobe-fonts/source-serif/blob/release/LICENSE.md',
    licenseFile: 'LICENSE.md',
    reservedFontName: null,
    source: { kind: 'google-fonts', repoPath: 'ofl/sourceserif4' },
    fallbackStack: 'Georgia, serif',
    previewText: 'A space that grows with you',
    notes: '與思源宋體同一設計語言，中英混排時筆形一致。',
  },
  {
    slug: 'jetbrains-mono',
    family: 'JetBrains Mono',
    displayName: 'JetBrains Mono',
    category: 'mono',
    scripts: ['latin'],
    weights: [400, 500, 700],
    license: 'OFL-1.1',
    licenseUrl: 'https://github.com/JetBrains/JetBrainsMono/blob/master/OFL.txt',
    licenseFile: 'OFL.txt',
    reservedFontName: null,
    source: { kind: 'google-fonts', repoPath: 'ofl/jetbrainsmono' },
    fallbackStack: 'ui-monospace, "SFMono-Regular", monospace',
    previewText: 'const space = grow(you)',
  },
]

export const ALL_FONTS: FontEntry[] = [...ZH_HANT_FONTS, ...LATIN_FONTS]

export function fontBySlug(slug: string): FontEntry | undefined {
  return ALL_FONTS.find((f) => f.slug === slug)
}

/**
 * 預設配對。
 *
 * 每一組都是「中文一套 + 拉丁一套」——
 * 沒有任何一套開源字體能同時把繁中與拉丁做到最好，
 * 硬用一套的結果是其中一邊將就。
 */
export type FontPairing = {
  slug: string
  name: string
  heading: string
  body: string
  ui: string
  /** 拉丁字元由這套負責，排在中文字體之前。 */
  latin: string
  moodTags: string[]
}

export const FONT_PAIRINGS: FontPairing[] = [
  {
    slug: 'clean',
    name: '乾淨',
    heading: 'noto-sans-tc',
    body: 'noto-sans-tc',
    ui: 'noto-sans-tc',
    latin: 'inter',
    moodTags: ['minimal', 'calm', 'default'],
  },
  {
    slug: 'editorial',
    name: '書卷',
    heading: 'noto-serif-tc',
    body: 'noto-sans-tc',
    ui: 'noto-sans-tc',
    latin: 'source-serif-4',
    moodTags: ['literary', 'warm'],
  },
  {
    slug: 'soft',
    name: '柔軟',
    heading: 'jf-open-huninn',
    body: 'jf-open-huninn',
    ui: 'jf-open-huninn',
    latin: 'inter',
    moodTags: ['playful', 'soft', 'warm'],
  },
  {
    slug: 'handwritten',
    name: '手寫',
    heading: 'iansui',
    body: 'lxgw-wenkai-tc',
    ui: 'noto-sans-tc',
    latin: 'cormorant-garamond',
    moodTags: ['personal', 'diary', 'quiet'],
  },
  {
    slug: 'elegant',
    name: '典雅',
    heading: 'playfair-display',
    body: 'chiron-sung-hk',
    ui: 'chiron-hei-hk',
    latin: 'playfair-display',
    moodTags: ['elegant', 'dramatic'],
  },
  {
    slug: 'modern',
    name: '現代',
    heading: 'chiron-hei-hk',
    body: 'chiron-hei-hk',
    ui: 'chiron-hei-hk',
    latin: 'inter',
    moodTags: ['modern', 'crisp'],
  },
]
