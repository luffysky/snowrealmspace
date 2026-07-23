/**
 * unicode-range 分片定義。
 *
 * ## 為什麼要分片
 *
 * 一套繁中字體 6–16 MB。整包載入在行動網路上要十幾秒，
 * 期間文字要嘛看不見（FOIT）要嘛跳版（FOUT）。
 *
 * 分片後每個 `@font-face` 只負責一段碼位，瀏覽器**只下載頁面上
 * 真的出現的字**所在的那幾片。
 *
 * ## 分片邊界怎麼決定：實測推翻了原本的假設
 *
 * 第一版按碼位平均切，理由是「常用字在 Unicode 中偏向集中在低碼位」。
 * `pnpm fonts:build --report` 量出來的結果否定了這個假設：
 *
 * ```
 * latin          55.7 KB     cjk-punct     66.5 KB
 * cjk-common-1   75.1 KB  （U+4E00-4FFF，512 字）
 * cjk-common-2  207.5 KB  （U+5000-53FF，1024 字）
 * ```
 *
 * 換算後**每個中文字形約 150–200 bytes**（woff2 壓縮後）。
 * 也就是 100 KB 的預算只裝得下 500–650 字 ——
 * 而 U+4E00-53FF 這段有 1536 字，其中大半是罕用字。
 *
 * 所以 critical 那一片必須按**字頻**挑字，不能按碼位切。
 * 下面的 `CJK_CORE_CHARS` 是明確列出的常用字表。
 *
 * ## 預算：ADR-016 的 100 KB 是沒量過就寫下的
 *
 * 固定可變字體的字重之後，13 套字體的首屏實測值：
 *
 * ```
 * 黑體類   36–50 KB   （昭源黑體 36.6、思源黑體 39.6、粉圓 48.3）
 * 宋體類   47–51 KB   （昭源宋體 47.3、思源宋體 50.5）
 * 楷/仿宋  71–83 KB   （霞鶩文楷 70.8、朱雀仿宋 79.9、芫荽 82.9）
 * 拉丁     20–74 KB   （JetBrains 19.6、Inter 42.9、Source Serif 73.8）
 * ```
 *
 * 單一字體壓進 100 KB 沒問題。**問題在配對**：
 * 一組字體配對可以指派到 4 套不同字體（標題／內文／介面／拉丁），
 * 「手寫」那組是芫荽＋霞鶩文楷＋思源黑體＋Cormorant ＝ 229 KB。
 *
 * 所以拆成兩層：
 *
 *   單一字體上限   中文 90 KB、拉丁 80 KB —— 建置時強制，超過直接失敗
 *   配對建議上限   100 KB —— **不強制**
 *
 * 配對不強制的理由：多字體配對是使用者的選擇，而且那個選擇有實際價值
 * （手寫體排日記就是比黑體好）。不該替他決定，但**必須讓他看到代價** ——
 * 字體選擇 UI 會顯示每一組的首屏大小。
 * 靜靜地讓他多等 130 KB 才是問題。
 */

export type UnicodeSlice = {
  id: string
  /** CSS unicode-range 的值 */
  range: string
  /** 首屏會用到 → 計入預算，並加 <link rel=preload> */
  critical: boolean
  description: string
}

/**
 * 繁體中文最常用字（依字頻排序，取前 240 字）。
 *
 * **240 這個數字是量出來的，不是選的。**
 * 實測 Noto Sans TC 每個常用字形約 284 bytes（woff2 後）——
 * 常用字筆畫多、結構複雜，比整體平均值高。
 * 70 KB ÷ 284 ≈ 252，取 240 留一點餘裕給字形較複雜的字體（宋體、楷體）。
 *
 * 這是首屏唯一會預載的中文分片。加字之前先跑
 * `pnpm fonts:build <slug> --report` 看預算還剩多少 ——
 * 超過的話建置會直接失敗，不會安靜地變慢。
 *
 * 排除的東西同樣重要：標點不放這裡（自成一片），
 * 注音也不放（只有部分頁面用得到）。
 */
export const CJK_CORE_CHARS =
  '的一是不了在人有我他這個們中來上大為和國地到以說時要就出會可也你對生能而子那得於著下自之年過發後作裡用道行所然家種事成方多經麼去法學如都同現當沒動面起看定天分還進好小部其些主樣理心她本前開但因只從想實日軍者意無力它與長把機十民第公此已工使情明性知全三又關點正業外將兩高間由問很最重並物手應戰向頭文體政美相見被利什二等產或新己制身果加西斯月話合回特代內信表化老給世位次度門任常先海通教兒原東聲提立及比員解水名真論處走義各入幾口認條平系氣題活爾更別打女變四神總何電數安少報才結反受目太'

/** 拉丁字體的分片。整套通常 < 200 KB，切兩片就夠。 */
export const LATIN_SLICES: UnicodeSlice[] = [
  {
    id: 'latin-basic',
    // 只有基本拉丁與最常見標點。實測 Inter 的 latin 全集是 130 KB，
    // 大半在擴充區與符號 —— 首屏根本用不到。
    range: 'U+0000-00FF,U+2010-2027,U+2030-205E,U+20AC',
    critical: true,
    description: '基本拉丁、常用標點、歐元符號',
  },
  {
    id: 'latin-ext',
    range: 'U+0100-024F,U+0259,U+1E00-1EFF,U+2000-200F,U+2028-202F,U+205F-206F,U+20A0-20AB,U+20AD-20BF,U+2190-21BB,U+2200-22FF,U+2600-26FF',
    critical: false,
    description: '拉丁擴充、其餘標點與貨幣、箭頭、數學與雜項符號',
  },
]

/**
 * 繁中字體的分片。
 *
 * 只有前兩片是 critical。其餘由瀏覽器依 unicode-range 在需要時才下載 ——
 * 那正是 unicode-range 存在的理由。
 */
export const ZH_HANT_SLICES: UnicodeSlice[] = [
  {
    id: 'cjk-punct-core',
    // 只有 CJK 標點本身。全形英數（U+FF00-FFEF）另外一片 ——
    // 把它放進來會多 50 KB，而那些字元在正常排版中很少出現。
    range: 'U+3000-303F',
    critical: true,
    description: 'CJK 標點。少了這片中文排版會到處是豆腐字。',
  },
  {
    id: 'cjk-core',
    // range 由 CJK_CORE_CHARS 產生，見 zhHantSlices()
    range: '',
    critical: true,
    description: '最常用的繁中字。首屏唯一預載的中文分片。',
  },

  // ── 以下皆非 critical，用到才下載 ──
  {
    id: 'fullwidth',
    range: 'U+FF00-FFEF,U+FE10-FE1F',
    critical: false,
    description: '全形英數與豎排標點',
  },
  {
    id: 'bopomofo',
    range: 'U+3100-312F,U+31A0-31BF,U+02C7,U+02CA,U+02CB,U+02D9',
    critical: false,
    description: '注音符號與聲調',
  },
  { id: 'cjk-1', range: 'U+4E00-4FFF', critical: false, description: 'CJK U+4E00 段' },
  { id: 'cjk-2', range: 'U+5000-51FF', critical: false, description: 'CJK U+5000 段' },
  { id: 'cjk-3', range: 'U+5200-53FF', critical: false, description: 'CJK U+5200 段' },
  { id: 'cjk-4', range: 'U+5400-55FF', critical: false, description: 'CJK U+5400 段' },
  { id: 'cjk-5', range: 'U+5600-57FF', critical: false, description: 'CJK U+5600 段' },
  { id: 'cjk-6', range: 'U+5800-59FF', critical: false, description: 'CJK U+5800 段' },
  { id: 'cjk-7', range: 'U+5A00-5BFF', critical: false, description: 'CJK U+5A00 段' },
  { id: 'cjk-8', range: 'U+5C00-5DFF', critical: false, description: 'CJK U+5C00 段' },
  { id: 'cjk-9', range: 'U+5E00-5FFF', critical: false, description: 'CJK U+5E00 段' },
  { id: 'cjk-10', range: 'U+6000-61FF', critical: false, description: 'CJK U+6000 段' },
  { id: 'cjk-11', range: 'U+6200-63FF', critical: false, description: 'CJK U+6200 段' },
  { id: 'cjk-12', range: 'U+6400-65FF', critical: false, description: 'CJK U+6400 段' },
  { id: 'cjk-13', range: 'U+6600-67FF', critical: false, description: 'CJK U+6600 段' },
  { id: 'cjk-14', range: 'U+6800-69FF', critical: false, description: 'CJK U+6800 段' },
  { id: 'cjk-15', range: 'U+6A00-6BFF', critical: false, description: 'CJK U+6A00 段' },
  { id: 'cjk-16', range: 'U+6C00-6DFF', critical: false, description: 'CJK U+6C00 段' },
  { id: 'cjk-17', range: 'U+6E00-6FFF', critical: false, description: 'CJK U+6E00 段' },
  { id: 'cjk-18', range: 'U+7000-71FF', critical: false, description: 'CJK U+7000 段' },
  { id: 'cjk-19', range: 'U+7200-73FF', critical: false, description: 'CJK U+7200 段' },
  { id: 'cjk-20', range: 'U+7400-75FF', critical: false, description: 'CJK U+7400 段' },
  { id: 'cjk-21', range: 'U+7600-77FF', critical: false, description: 'CJK U+7600 段' },
  { id: 'cjk-22', range: 'U+7800-79FF', critical: false, description: 'CJK U+7800 段' },
  { id: 'cjk-23', range: 'U+7A00-7BFF', critical: false, description: 'CJK U+7A00 段' },
  { id: 'cjk-24', range: 'U+7C00-7DFF', critical: false, description: 'CJK U+7C00 段' },
  { id: 'cjk-25', range: 'U+7E00-7FFF', critical: false, description: 'CJK U+7E00 段' },
  { id: 'cjk-26', range: 'U+8000-81FF', critical: false, description: 'CJK U+8000 段' },
  { id: 'cjk-27', range: 'U+8200-83FF', critical: false, description: 'CJK U+8200 段' },
  { id: 'cjk-28', range: 'U+8400-85FF', critical: false, description: 'CJK U+8400 段' },
  { id: 'cjk-29', range: 'U+8600-87FF', critical: false, description: 'CJK U+8600 段' },
  { id: 'cjk-30', range: 'U+8800-89FF', critical: false, description: 'CJK U+8800 段' },
  { id: 'cjk-31', range: 'U+8A00-8BFF', critical: false, description: 'CJK U+8A00 段' },
  { id: 'cjk-32', range: 'U+8C00-8DFF', critical: false, description: 'CJK U+8C00 段' },
  { id: 'cjk-33', range: 'U+8E00-8FFF', critical: false, description: 'CJK U+8E00 段' },
  { id: 'cjk-34', range: 'U+9000-91FF', critical: false, description: 'CJK U+9000 段' },
  { id: 'cjk-35', range: 'U+9200-93FF', critical: false, description: 'CJK U+9200 段' },
  { id: 'cjk-36', range: 'U+9400-95FF', critical: false, description: 'CJK U+9400 段' },
  { id: 'cjk-37', range: 'U+9600-97FF', critical: false, description: 'CJK U+9600 段' },
  { id: 'cjk-38', range: 'U+9800-99FF', critical: false, description: 'CJK U+9800 段' },
  { id: 'cjk-39', range: 'U+9A00-9BFF', critical: false, description: 'CJK U+9A00 段' },
  { id: 'cjk-40', range: 'U+9C00-9DFF', critical: false, description: 'CJK U+9C00 段' },
  { id: 'cjk-41', range: 'U+9E00-9FFF', critical: false, description: 'CJK U+9E00 段' },
  {
    id: 'cjk-ext-a',
    range: 'U+3400-4DBF',
    critical: false,
    description: '擴充 A。罕見字與人名用字。',
  },
  {
    id: 'cjk-compat',
    range: 'U+F900-FAFF',
    critical: false,
    description: '相容表意文字。人名地名偶爾用到。',
  },
]

/**
 * 首屏預算。數字全部來自實測，見本檔開頭。
 *
 * `pairing` 是建議值不是硬限制 —— 超過只會在 UI 上顯示成本，
 * 不會擋下使用者的選擇。
 */
export const FIRST_SCREEN_BUDGET = {
  /** 單一繁中字體。最重的芫荽是 82.9 KB，留一點餘裕。 */
  zhHant: 90 * 1024,
  /** 單一拉丁字體。最重的 Source Serif 4 是 73.8 KB。 */
  latin: 80 * 1024,
  /** 一組字體配對的建議總量。超過會在 UI 標示，不會阻止。 */
  pairing: 100 * 1024,
} as const

/**
 * 一組配對的首屏總量。
 *
 * 同一套字體被指派到多個角色時只算一次 ——
 * 瀏覽器不會重複下載同一個檔案。
 */
export function pairingFirstScreenBytes(
  fontSlugs: readonly string[],
  bytesBySlug: Readonly<Record<string, number>>,
): number {
  return [...new Set(fontSlugs)].reduce((sum, slug) => sum + (bytesBySlug[slug] ?? 0), 0)
}

/**
 * 把字元集合壓成緊湊的 CSS unicode-range。
 *
 * 連續的碼位會合併成 `U+4E00-4E05` 而不是逐一列出。
 * 常用字表約 500 字，逐一列出的 CSS 會超過 4 KB；
 * 合併後通常能少一半以上。
 */
export function formatUnicodeRange(chars: string): string {
  const codepoints = [...new Set([...chars].map((c) => c.codePointAt(0)!))].sort((a, b) => a - b)
  if (codepoints.length === 0) return ''

  const parts: string[] = []
  let start = codepoints[0]!
  let prev = start

  for (const cp of codepoints.slice(1)) {
    if (cp === prev + 1) {
      prev = cp
      continue
    }
    parts.push(formatPart(start, prev))
    start = cp
    prev = cp
  }
  parts.push(formatPart(start, prev))

  return parts.join(',')
}

function formatPart(start: number, end: number): string {
  const hex = (n: number) => n.toString(16).toUpperCase().padStart(4, '0')
  return start === end ? `U+${hex(start)}` : `U+${hex(start)}-${hex(end)}`
}

/** 繁中分片，`cjk-core` 的 range 由常用字表算出。 */
export function zhHantSlices(): UnicodeSlice[] {
  const coreRange = formatUnicodeRange(CJK_CORE_CHARS)
  return ZH_HANT_SLICES.map((slice) =>
    slice.id === 'cjk-core' ? { ...slice, range: coreRange } : slice,
  )
}

export function slicesForScripts(scripts: readonly string[]): UnicodeSlice[] {
  return scripts.includes('zh-Hant') ? zhHantSlices() : LATIN_SLICES
}

export function budgetForScripts(scripts: readonly string[]): number {
  return scripts.includes('zh-Hant') ? FIRST_SCREEN_BUDGET.zhHant : FIRST_SCREEN_BUDGET.latin
}

/**
 * 把 CSS 的 unicode-range 字串解析成碼位陣列，供子集工具使用。
 *
 * 只接受 `U+XXXX` 與 `U+XXXX-YYYY`。
 * 不支援 `U+4??` 萬用字元 —— CSS 允許，但解析規則容易寫錯，
 * 而我們的分片定義本來就不需要它。
 */
export function parseUnicodeRange(range: string): number[] {
  const codepoints: number[] = []

  for (const part of range.split(',')) {
    const token = part.trim()
    if (!token) continue

    const match = /^U\+([0-9A-Fa-f]{1,6})(?:-([0-9A-Fa-f]{1,6}))?$/.exec(token)
    if (!match) throw new Error(`無法解析的 unicode-range 片段：${token}`)

    const start = parseInt(match[1]!, 16)
    const end = match[2] ? parseInt(match[2], 16) : start
    if (end < start) throw new Error(`unicode-range 起訖顛倒：${token}`)

    for (let cp = start; cp <= end; cp++) codepoints.push(cp)
  }

  return codepoints
}
