/**
 * 內建 Lottie 向量動畫背景清單。
 *
 * 動畫 JSON 由 scripts/build-lottie.mjs 生成（本專案自製 → CC0 / 專案自有，
 * 授權明確、無第三方素材）。位元組不入 assets：與 procedural/scene 同屬「程式生成」
 * 來源，符合 ADR-005。
 *
 * loader 用靜態 import 對映（動態模板字串 import 無法被 webpack 靜態分析）。
 */

import manifest from './lottie/manifest.json'

export type LottieSceneDef = {
  id: string
  label: string
  /** 建議搭配的底色（動畫本身透明，鋪在這色上最好看）。屬動畫內容，來源 manifest.json。 */
  bg: string
  mood: string
}

export const LOTTIE_SCENES: LottieSceneDef[] = manifest as LottieSceneDef[]

const LOADERS: Record<string, () => Promise<{ default: unknown }>> = {
  'soft-aurora': () => import('./lottie/soft-aurora.json'),
  'rising-bubbles': () => import('./lottie/rising-bubbles.json'),
  'pulse-rings': () => import('./lottie/pulse-rings.json'),
  'drifting-petals': () => import('./lottie/drifting-petals.json'),
  'starfield-twinkle': () => import('./lottie/starfield-twinkle.json'),
}

export function getLottieScene(id: string | null | undefined): LottieSceneDef | undefined {
  if (!id) return undefined
  return LOTTIE_SCENES.find((s) => s.id === id)
}

/** 懶載入動畫資料（回 null 表示未知 id）。 */
export async function loadLottieData(id: string): Promise<unknown | null> {
  const loader = LOADERS[id]
  if (!loader) return null
  const mod = await loader()
  return mod.default ?? null
}
