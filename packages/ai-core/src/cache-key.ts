/**
 * 回應快取的 key 正規化。見 docs/spec/12-ai-model-routing.md §5.2。
 * 語意快取（pgvector）在 DB 層，這裡是精確快取的字串正規化。
 */

/**
 * 正規化問題文字，讓「意思一樣、標點/空白不同」的問題命中同一筆快取。
 * 全形空白(U+3000) 轉半形、連續空白收斂、轉小寫、去結尾標點。
 * regex 用 unicode escape，避免 no-irregular-whitespace。
 */
export function normalizeQuestion(text: string): string {
  let s = text.trim()
  s = s.replace(/\u3000/g, ' ') // 全形空白
  s = s.replace(/\s+/g, ' ') // 連續空白
  s = s.toLowerCase()
  s = s.replace(/[？?。!！～~…\s]+$/u, '') // 結尾標點
  return s
}

/** 語意快取的 cosine 相似度門檻（§5.2）。不可調低 —— 以下會開始回錯答案。 */
export const SEMANTIC_CACHE_THRESHOLD = 0.93
