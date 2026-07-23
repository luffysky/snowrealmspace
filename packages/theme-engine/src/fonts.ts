/**
 * 把 fontId 解析成真正的 `font-family`，並產生 `@font-face`。
 *
 * ## 為什麼這一層一直缺著
 *
 * `compileThemeToCssVars` 只輸出 `--sr-font-body-id`。那是刻意的 ——
 * 主題套用必須在 <150ms 內完成（05-theme-tokens.md §4），
 * 不能等字體檔下載。但缺了這一層，`--sr-font-*-id` 就沒有任何東西讀，
 * 頁面實際用的是 CSS 檔裡的預設堆疊，**使用者選了字體卻不會生效**。
 *
 * 補法是兩段式：
 *   1. 主題套用時立刻寫入 `--sr-font-*`（用 fallback stack）→ 版面立即定案
 *   2. 字體檔載入完成後把同一個變數換成真正的 family → 只換字形，不動版面
 *
 * ## 中文與拉丁必須分開
 *
 * 沒有任何一套開源字體能同時把繁中與拉丁做到最好。
 * 所以 font-family 是一個**堆疊**，拉丁字體排在中文字體之前 ——
 * 瀏覽器逐一嘗試，拉丁字元由拉丁字體負責，中文字元 fall through 到中文字體。
 * 順序反過來的話中文字體會接走英數字，字重與字寬都會不對。
 */

export type ResolvedFont = {
  slug: string
  family: string
  fallbackStack: string
  weights: number[]
}

export type FontRole = 'heading' | 'body' | 'ui' | 'mono'

/**
 * 組出 font-family 值。
 *
 * 一律加引號：字體名稱含空白或非 ASCII（例如「jf open 粉圓」）時，
 * 沒有引號的 CSS 是無效的，而瀏覽器會**安靜地忽略整條宣告** ——
 * 不是報錯，是整個 font-family 沒了。
 */
export function buildFontFamily(
  primary: ResolvedFont,
  latin?: ResolvedFont | undefined,
): string {
  const parts: string[] = []

  // 拉丁字體在前：它只涵蓋英數字，中文字元會自然 fall through
  if (latin && latin.slug !== primary.slug) parts.push(quote(latin.family))

  parts.push(quote(primary.family))

  // fallbackStack 已是合法的 CSS 片段（含系統字體名），原樣接上
  if (primary.fallbackStack) parts.push(primary.fallbackStack)

  return parts.join(', ')
}

function quote(family: string): string {
  // 純 ASCII 且無空白的名稱不需引號，加了也無妨；統一加比較不容易出錯
  return `"${family.replace(/"/g, '')}"`
}

export type FontAssignment = {
  heading: ResolvedFont
  body: ResolvedFont
  ui: ResolvedFont
  mono?: ResolvedFont | undefined
  latin?: ResolvedFont | undefined
}

/**
 * 產生要寫進 `document.documentElement.style` 的 CSS 變數。
 *
 * 回傳的是**完整覆寫**而不是增量：
 * 換主題時舊字體的變數必須被蓋掉，否則 heading 換了、body 沒換的
 * 混合狀態會留在畫面上。
 */
export function compileFontVars(assignment: FontAssignment): Record<string, string> {
  const vars: Record<string, string> = {
    '--sr-font-heading': buildFontFamily(assignment.heading, assignment.latin),
    '--sr-font-body': buildFontFamily(assignment.body, assignment.latin),
    '--sr-font-ui': buildFontFamily(assignment.ui, assignment.latin),
  }

  // mono 不套拉丁字體 —— 等寬的意義就在於每個字元同寬，
  // 混進另一套字體會破壞對齊。
  if (assignment.mono) {
    vars['--sr-font-mono'] = buildFontFamily(assignment.mono)
  }

  return vars
}

export type FontSubset = {
  /** R2 上的 woff2 路徑 */
  url: string
  /** CSS unicode-range 值，例如 "U+4E00-4EFF" */
  unicodeRange: string
}

export type FontFaceSpec = {
  family: string
  weight: number
  style: 'normal' | 'italic'
  subsets: FontSubset[]
  /**
   * 中文字體必須用 `swap`：分片檔加起來仍有數 MB，
   * `block` 會讓文字在載入前完全看不見（FOIT），
   * 在慢速網路上等同於白畫面。
   */
  display: 'swap' | 'optional'
  ascentOverride?: string | undefined
  descentOverride?: string | undefined
}

/**
 * 產生 `@font-face` 規則。
 *
 * 每個 unicode-range 分片是**獨立**的 `@font-face`，family 相同。
 * 瀏覽器只會下載頁面上真的用到的那幾片 ——
 * 這是繁中字體能上 web 的唯一原因（整套 6–9 MB，分片後首屏通常 < 100 KB）。
 */
export function buildFontFaceCss(spec: FontFaceSpec): string {
  const metrics: string[] = []
  if (spec.ascentOverride) metrics.push(`  ascent-override: ${spec.ascentOverride};`)
  if (spec.descentOverride) metrics.push(`  descent-override: ${spec.descentOverride};`)

  return spec.subsets
    .map((subset) =>
      [
        '@font-face {',
        `  font-family: "${spec.family}";`,
        `  font-style: ${spec.style};`,
        `  font-weight: ${spec.weight};`,
        `  font-display: ${spec.display};`,
        `  src: url("${subset.url}") format("woff2");`,
        `  unicode-range: ${subset.unicodeRange};`,
        ...metrics,
        '}',
      ].join('\n'),
    )
    .join('\n\n')
}

/**
 * 找出「這次要用、上次沒用」與「上次用了、這次不用」的字體。
 *
 * 換主題時必須把不再需要的 `@font-face` 卸載（ADR-016）。
 * 不卸載的話，換過五次主題就有五套字體的規則留在文件裡，
 * 瀏覽器會為了決定用哪一個而重算，且記憶體不會釋放。
 */
export function diffFontUsage(
  previous: readonly string[],
  next: readonly string[],
): { toLoad: string[]; toUnload: string[] } {
  const prev = new Set(previous)
  const now = new Set(next)
  return {
    toLoad: [...now].filter((slug) => !prev.has(slug)),
    toUnload: [...prev].filter((slug) => !now.has(slug)),
  }
}

/**
 * 首屏預算檢查。ADR-016 要求首屏字體 < 100 KB。
 *
 * 回傳超出的位元組數而不是布林：呼叫端要能說出「超了多少」，
 * 只說「超了」等於沒有資訊。
 */
export function firstScreenBudget(
  subsets: readonly { bytes: number; critical: boolean }[],
  budgetBytes = 100 * 1024,
): { totalBytes: number; overBy: number; withinBudget: boolean } {
  const totalBytes = subsets.filter((s) => s.critical).reduce((sum, s) => sum + s.bytes, 0)
  const overBy = Math.max(0, totalBytes - budgetBytes)
  return { totalBytes, overBy, withinBudget: overBy === 0 }
}
