/* eslint-disable no-restricted-syntax -- 這個檔案是 token 的定義處，不是使用處 */

/**
 * 預設主題的字面值。
 *
 * 這是全專案唯一允許出現字面顏色的地方（見 05-theme-tokens.md §7 的豁免）。
 * 其他所有元件必須用 var(--sr-*)。
 *
 * Milestone B 起，這裡會被 packages/theme-engine 的 ThemeDefinition 取代，
 * 屆時值改由資料庫的 active theme 提供，這個檔案只留 fallback。
 */
export const DEFAULT_THEME = {
  /** 瀏覽器 UI（分頁列、狀態列）的顏色。必須是字面值，無法用 CSS 變數。 */
  browserThemeColor: '#fff7fb',
} as const
