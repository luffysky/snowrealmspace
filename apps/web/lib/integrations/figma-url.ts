/**
 * 從使用者貼上的文字擷取 Figma 檔案 key（可多筆）。
 *
 * 為什麼需要它：Figma REST API 沒有「列出我所有檔案」的端點（只能指向 Team/Project），
 * 但同步「單一檔案」只需要它的 file key（`GET /v1/files/:key`），而 `POST /sync` 也正是
 * 吃 file key（externalIds）。因此讓使用者直接貼「檔案網址」、抽出 key 即可同步，
 * 不必先知道專案 ID —— 大幅改善 Figma 的加檔體驗。
 *
 * 支援格式（type segment 後緊接的那一段就是 key）：
 *   - https://www.figma.com/file/<KEY>/<name>      設計檔（舊網址）
 *   - https://www.figma.com/design/<KEY>/<name>    設計檔（新網址）
 *   - https://www.figma.com/board/<KEY>/...         FigJam
 *   - https://www.figma.com/proto/<KEY>/...         原型
 *   - 直接貼「裸 key」（英數 15–40 字）
 *
 * 可一次貼多筆（換行 / 空白 / 逗號分隔），會**去重**並忽略無法辨識的雜訊。
 * 純函式、無副作用 —— 方便單元測試。
 */

/** file key 的字元與長度規則（Figma key 為英數 base62，長度約 15–40）。 */
const KEY_PATTERN = '[A-Za-z0-9]{15,40}'
/** 從 Figma 網址擷取 type segment 後的 key。大小寫不敏感、允許 http/https/無協定/無 www。 */
const FIGMA_URL_RE = new RegExp(`figma\\.com/(?:file|design|board|proto)/(${KEY_PATTERN})`, 'i')
/** 整段 token 本身就是一個裸 key。 */
const BARE_KEY_RE = new RegExp(`^${KEY_PATTERN}$`)

export function extractFigmaKeys(input: string): string[] {
  if (typeof input !== 'string' || input.trim() === '') return []

  const keys: string[] = []
  const seen = new Set<string>()
  const add = (k: string) => {
    if (seen.has(k)) return
    seen.add(k)
    keys.push(k)
  }

  // 依換行 / 空白 / 逗號切成 token 逐一判斷（合法 Figma 網址本身不含這些分隔字元）
  for (const token of input.split(/[\s,]+/)) {
    if (!token) continue
    const m = FIGMA_URL_RE.exec(token)
    if (m && m[1]) {
      add(m[1])
      continue
    }
    if (BARE_KEY_RE.test(token)) {
      add(token)
      continue
    }
    // 其餘（非 Figma 網址、過短/過長字串、雜訊）一律忽略
  }

  return keys
}
