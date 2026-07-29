/**
 * 裝飾品目錄（Fluent Emoji Color）。
 *
 * 素材是 Microsoft Fluent Emoji（MIT，見同目錄 LICENSE.md），以 SVG 靜態檔提供，
 * 服務於 /decorations/<id>.svg。位元組不入 assets：與 lottie / scene 同屬「內建、
 * 授權明確的第三方美術資產」，非使用者上傳，符合 ADR-005 的精神（assets 只裝
 * 使用者自己的檔案）。
 *
 * 風格對齊 lib/lottie-scenes.ts：型別 + 從 manifest.json 載入的清單 + 查詢 helper。
 */

import manifest from './manifest.json'

/** 分類鍵（與 manifest.categoryKey 同一組詞彙）。 */
export type DecorationCategoryKey = 'animal' | 'plant' | 'sweet' | 'sky' | 'heart' | 'cute'

export type Decoration = {
  /** 檔名主幹，同時是 API 傳入值；對映 /decorations/<id>.svg。 */
  id: string
  /** 繁中顯示名。 */
  label: string
  /** 繁中分類名（供 UI 標題）。 */
  category: string
  /** 分類鍵（供分組與排序）。 */
  categoryKey: DecorationCategoryKey
}

export const DECORATIONS: Decoration[] = manifest as Decoration[]

/** 分類的固定顯示順序（繁中名 + 鍵）。 */
export const DECORATION_CATEGORIES: { key: DecorationCategoryKey; label: string }[] = [
  { key: 'animal', label: '動物' },
  { key: 'plant', label: '植物' },
  { key: 'sweet', label: '甜點' },
  { key: 'sky', label: '天空' },
  { key: 'heart', label: '愛心' },
  { key: 'cute', label: '可愛' },
]

/** 某分類底下的裝飾品（維持 manifest 內的排列順序）。 */
export function decorationsByCategory(key: DecorationCategoryKey): Decoration[] {
  return DECORATIONS.filter((d) => d.categoryKey === key)
}

/** 由 id 組出靜態 SVG 路徑。 */
export function decorationSrc(id: string): string {
  return `/decorations/${id}.svg`
}

// 已知 id 的集合：API 用它把使用者傳入值收斂到內建名單，未知值一律拒絕。
const DECORATION_IDS = new Set<string>(DECORATIONS.map((d) => d.id))

/** 型別守衛：x 是否為已知裝飾品 id。用於驗證 API 輸入。 */
export function isDecorationId(x: unknown): x is string {
  return typeof x === 'string' && DECORATION_IDS.has(x)
}
