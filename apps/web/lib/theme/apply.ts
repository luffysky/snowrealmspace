import {
  compileThemeToCssVars,
  themeDataAttributes,
  type ThemeDefinition,
} from '@snowrealm/theme-engine'

/**
 * 套用主題到 DOM。
 *
 * v1.0 §42.1：主題切換 < 150ms。
 * 唯一做得到的方式是**直接寫 :root 的 style，不經過 React**。
 * 用 React state 驅動顏色會讓整棵樹重渲染，遠超 150ms。
 *
 * React 只需要知道「哪個 theme id 是 active」，顏色全走 CSS 變數。
 */
export function applyThemeToDom(def: ThemeDefinition, target?: HTMLElement): void {
  const root = target ?? document.documentElement
  const vars = compileThemeToCssVars(def)

  // 單次批次寫入。逐個 setProperty 會觸發多次 style 重算。
  const cssText = Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(';')

  root.style.cssText = cssText

  for (const [attr, value] of Object.entries(themeDataAttributes(def))) {
    root.setAttribute(attr, value)
  }
}

/**
 * 預覽用：套用到某個容器而非整個頁面。
 * Theme Studio 的即時預覽用這個，才不會邊調邊改變整個介面。
 */
export function applyThemeToPreview(def: ThemeDefinition, element: HTMLElement): void {
  applyThemeToDom(def, element)
}

/** 清除套用的變數，回到 CSS 檔案定義的預設值。 */
export function clearAppliedTheme(target?: HTMLElement): void {
  const root = target ?? document.documentElement
  root.style.cssText = ''
  for (const attr of ['data-surface-style', 'data-motion-preset', 'data-shadow', 'data-glow', 'data-noise']) {
    root.removeAttribute(attr)
  }
}
