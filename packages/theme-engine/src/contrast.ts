import { contrastRatio, parseColor, compositeOver, toHex } from './color.js'
import type { A11yReport, ContrastPair, ContrastSize, ThemeDefinition } from './types.js'

/**
 * ADR-011：WCAG 2.2 AA 是硬需求。
 *
 * 產品自身介面必須符合。使用者建立的主題允許不合格但會顯示警告，
 * 且套用時功能性元素（focus ring / 錯誤訊息 / disabled）強制 fallback。
 */

export const THRESHOLDS: Record<ContrastSize, { aa: number; aaa: number }> = {
  // 一般文字（< 18.66px 或 < 24px 非粗體）
  normal: { aa: 4.5, aaa: 7 },
  // 大字（≥ 24px 或 ≥ 18.66px 粗體）
  large: { aa: 3, aaa: 4.5 },
  // UI 元件邊界、圖示、focus indicator。
  // WCAG 對非文字對比**沒有定義 AAA**，因此 aaa 設為 Infinity ——
  // 寫成 3 會讓剛好 3:1 的值被標成 AAA，那是錯的。
  ui: { aa: 3, aaa: Infinity },
}

export function wcagLevel(ratio: number, size: ContrastSize): 'fail' | 'AA' | 'AAA' {
  const t = THRESHOLDS[size]
  if (ratio >= t.aaa) return 'AAA'
  if (ratio >= t.aa) return 'AA'
  return 'fail'
}

function pair(
  label: string,
  fg: string,
  bg: string,
  size: ContrastSize,
  advisory = false,
): ContrastPair {
  const ratio = contrastRatio(fg, bg)
  const base: ContrastPair = {
    label,
    fg,
    bg,
    size,
    ratio: Math.round(ratio * 100) / 100,
    required: THRESHOLDS[size].aa,
    level: wcagLevel(ratio, size),
  }
  return advisory ? { ...base, advisory: true } : base
}

/**
 * 把半透明的 surface 疊到 background 上，得到實際看到的顏色。
 * 對比計算必須用這個值，不能用 rgba 本身。
 */
export function flattenSurface(surface: string, background: string): string {
  const s = parseColor(surface)
  const b = parseColor(background)
  if (!s || !b) return surface
  if (s.a >= 1) return surface
  return toHex(compositeOver(s, b))
}

/**
 * 產生完整的對比報告。
 * 必檢組合見 docs/spec/05-theme-tokens.md §3.2。
 */
export function analyzeTheme(def: ThemeDefinition): A11yReport {
  const c = def.colors
  const surfaceFlat = flattenSurface(c.surface, c.background)
  const surfaceAltFlat = flattenSurface(c.surfaceAlt, c.background)

  const pairs: ContrastPair[] = [
    pair('主要文字 / 背景', c.textPrimary, c.background, 'normal'),
    pair('主要文字 / 卡片', c.textPrimary, surfaceFlat, 'normal'),
    pair('次要文字 / 背景', c.textSecondary, c.background, 'normal'),
    pair('次要文字 / 卡片', c.textSecondary, surfaceFlat, 'normal'),
    pair('次要文字 / 淺卡片', c.textSecondary, surfaceAltFlat, 'normal'),
    pair('主色上的文字', pickOn(c.primary), c.primary, 'normal'),
    pair('強調色上的文字', pickOn(c.accent), c.accent, 'normal'),
    // 卡片邊框是裝飾性的（卡片靠底色與陰影辨識），列為參考。見 types.ts 的說明。
    pair('卡片邊框 / 背景', flattenSurface(c.border, c.background), c.background, 'ui', true),
    // Focus indicator 是「識別狀態所必需」，不可 advisory
    pair('Focus 外框 / 背景', c.focusRing, c.background, 'ui'),
    pair('Focus 外框 / 卡片', c.focusRing, surfaceFlat, 'ui'),
    pair('錯誤色 / 背景', c.danger, c.background, 'normal'),
    pair('成功色 / 背景', c.success, c.background, 'normal'),
    pair('警告色 / 背景', c.warning, c.background, 'normal'),
  ]

  const blocking = pairs.filter((p) => !p.advisory)
  const failing = blocking.filter((p) => p.level === 'fail')
  const advisories = pairs.filter((p) => p.advisory && p.level === 'fail')

  // worstRatio 只看會擋下的組合 —— 裝飾性邊框本來就低，
  // 讓它拉低這個數字會讓指標失去意義。
  const worstRatio = blocking.reduce((min, p) => Math.min(min, p.ratio), Infinity)

  return {
    pairs,
    worstRatio: Number.isFinite(worstRatio) ? worstRatio : 1,
    passesAA: failing.length === 0,
    failing: failing.map((p) => p.label),
    advisories: advisories.map((p) => p.label),
  }
}

function pickOn(bg: string): string {
  return contrastRatio('#ffffff', bg) >= contrastRatio('#1a1a1a', bg) ? '#ffffff' : '#1a1a1a'
}

/**
 * 給使用者的具體修改建議。
 *
 * Theme Studio 不能只顯示紅色叉叉 —— 那等於告訴使用者「你錯了」卻不說怎麼改。
 * 這裡算出「明度要調整多少」才會達標。
 */
export function suggestFix(p: ContrastPair): string | null {
  if (p.level !== 'fail') return null

  const bgRgba = parseColor(p.bg)
  if (!bgRgba) return null

  const bgIsLight = (bgRgba.r * 299 + bgRgba.g * 587 + bgRgba.b * 114) / 1000 > 128
  const direction = bgIsLight ? '調暗' : '調亮'
  const gap = Math.round((p.required - p.ratio) * 100) / 100

  return `目前 ${p.ratio}:1，需要 ${p.required}:1。把${p.label.split(' / ')[0]}${direction}一些即可（還差 ${gap}）。`
}
