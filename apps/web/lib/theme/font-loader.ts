import {
  buildFontFaceCss,
  compileFontVars,
  diffFontUsage,
  type ResolvedFont,
  type FontAssignment,
} from '@snowrealm/theme-engine'

/**
 * 執行期字體載入。
 *
 * ## 兩段式，不是一段
 *
 * 主題套用必須在 150ms 內完成（v1.0 §42.1），而中文字體的
 * critical 分片有 30–80 KB，慢速網路上載不完。所以：
 *
 *   1. `applyFontVars()` 立刻寫入 `--sr-font-*` —— 值是完整堆疊，
 *      系統 fallback 在最後，版面立刻定案
 *   2. `loadFontFaces()` 注入 `@font-face`，瀏覽器按 unicode-range
 *      下載需要的分片，載完只換字形不動版面
 *
 * 順序反過來（等字體載完才套變數）會讓主題切換卡住好幾秒。
 *
 * ## 為什麼不用 CSS Font Loading API
 *
 * `new FontFace()` 一次只能載一個檔，而我們一套字體有 45 片。
 * 用 `@font-face` + unicode-range 讓瀏覽器自己決定要載哪幾片 ——
 * 那是它做得比我們好的事。
 */

const STYLE_ID = 'sr-font-faces'

export type FontManifestEntry = {
  slug: string
  family: string
  fallbackStack: string
  weights: number[]
  /** weight → 分片清單 */
  files: Record<string, { file: string; unicodeRange: string; critical: boolean }[]>
}

/** 目前已注入的字體。用來算出換主題時要卸載哪些。 */
let loadedSlugs: string[] = []

function styleElement(): HTMLStyleElement {
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = STYLE_ID
    document.head.appendChild(el)
  }
  return el
}

function toResolved(entry: FontManifestEntry): ResolvedFont {
  return {
    slug: entry.slug,
    family: entry.family,
    fallbackStack: entry.fallbackStack,
    weights: entry.weights,
  }
}

/**
 * 立刻套用 font-family 變數。**不等任何下載。**
 */
export function applyFontVars(
  assignment: {
    heading: FontManifestEntry
    body: FontManifestEntry
    ui: FontManifestEntry
    mono?: FontManifestEntry | undefined
    latin?: FontManifestEntry | undefined
  },
  target?: HTMLElement,
): void {
  const root = target ?? document.documentElement

  const resolved: FontAssignment = {
    heading: toResolved(assignment.heading),
    body: toResolved(assignment.body),
    ui: toResolved(assignment.ui),
    mono: assignment.mono ? toResolved(assignment.mono) : undefined,
    latin: assignment.latin ? toResolved(assignment.latin) : undefined,
  }

  for (const [name, value] of Object.entries(compileFontVars(resolved))) {
    root.style.setProperty(name, value)
  }
}

/**
 * 注入 `@font-face`，並卸載不再使用的。
 *
 * 卸載是必要的：不卸載的話，換過五次主題就有五套字體的規則留在文件裡，
 * 瀏覽器每次配字都要多比對一輪，記憶體也不會釋放（ADR-016）。
 */
export function loadFontFaces(entries: FontManifestEntry[], baseUrl = ''): void {
  const next = entries.map((e) => e.slug)
  const { toLoad, toUnload } = diffFontUsage(loadedSlugs, next)

  // 沒有變化就什麼都不做 —— 重複套用同一個主題不該重寫 <style>，
  // 那會讓瀏覽器丟掉已解析的字體並重新下載。
  if (toLoad.length === 0 && toUnload.length === 0) return

  const css = entries
    .flatMap((entry) =>
      entry.weights.map((weight) => {
        const subsets = entry.files[String(weight)] ?? []
        return buildFontFaceCss({
          family: entry.family,
          weight,
          style: 'normal',
          // 中文字體的分片加起來仍有數 MB，block 會造成白畫面（FOIT）
          display: 'swap',
          subsets: subsets.map((s) => ({
            url: `${baseUrl}${s.file}`,
            unicodeRange: s.unicodeRange,
          })),
        })
      }),
    )
    .filter(Boolean)
    .join('\n\n')

  styleElement().textContent = css
  loadedSlugs = next
}

/**
 * 預載 critical 分片。
 *
 * 只預載 400 字重的 critical 片 —— 首屏幾乎都是內文字重，
 * 把全部字重都預載會下載一堆用不到的東西。
 */
export function preloadCriticalFonts(entries: FontManifestEntry[], baseUrl = ''): void {
  for (const entry of entries) {
    const subsets = entry.files['400'] ?? []
    for (const subset of subsets) {
      if (!subset.critical) continue

      const href = `${baseUrl}${subset.file}`
      if (document.head.querySelector(`link[rel="preload"][href="${CSS.escape(href)}"]`)) continue

      const link = document.createElement('link')
      link.rel = 'preload'
      link.as = 'font'
      link.type = 'font/woff2'
      link.href = href
      // 字體一律是 CORS 請求，即使同源。少了這個屬性瀏覽器會
      // 預載一份、實際用時再載一份 —— 下載兩次卻沒有加速。
      link.crossOrigin = 'anonymous'
      document.head.appendChild(link)
    }
  }
}

/** 測試用：重置已載入狀態。 */
export function resetFontLoaderState(): void {
  loadedSlugs = []
  document.getElementById(STYLE_ID)?.remove()
}
