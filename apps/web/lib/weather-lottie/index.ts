/**
 * 天氣 condition → jochang 天氣動畫圖示的純對應與懶載入。
 *
 * 素材為 LottieFiles 上 jochang 的天氣系列（Lottie Simple License，免費可商用）——
 * 見同資料夾 LICENSE.md。皆為純 keyframe 動畫（無 expression、無外部圖片資產），
 * 故 lottie_light 播得動、也能離線打包。JSON 隨專案打包，與 lib/lottie-scenes.ts 相同：
 * 位元組屬「明確授權的內建素材」，非使用者檔案，符合 ADR-005。
 *
 * loader 用靜態 import 對映（動態模板字串 import 無法被 webpack 靜態分析），每個 JSON
 * 因此各自 code-split，只有真的顯示該圖示時才會被拉下來。
 */

import type { WeatherCondition } from '@snowrealm/validation'

/** 目前有素材的圖示名稱（＝檔名，不含副檔名）。 */
export type WeatherIconName =
  | 'clear-day'
  | 'clear-night'
  | 'overcast-day'
  | 'overcast-night'
  | 'fog-day'
  | 'fog-night'
  | 'drizzle'
  | 'rain-day'
  | 'rain-night'
  | 'snow'
  | 'thunderstorms-day-rain'
  | 'thunderstorms-night-rain'
  | 'hurricane'

/**
 * condition（+ 日/夜）→ 圖示名稱。純資料對應、無副作用。
 * 有日夜之分的用 -day / -night，其餘（毛毛雨、雪、颱風）日夜共用一張。
 */
export function weatherIconName(condition: WeatherCondition, isDay: boolean): WeatherIconName {
  switch (condition) {
    case 'clear':
      return isDay ? 'clear-day' : 'clear-night'
    case 'cloudy':
      return isDay ? 'overcast-day' : 'overcast-night'
    case 'fog':
      return isDay ? 'fog-day' : 'fog-night'
    case 'drizzle':
      return 'drizzle'
    case 'rain':
      return isDay ? 'rain-day' : 'rain-night'
    case 'snow':
      return 'snow'
    case 'thunder':
      return isDay ? 'thunderstorms-day-rain' : 'thunderstorms-night-rain'
    case 'typhoon':
      return 'hurricane'
  }
}

const LOADERS: Record<WeatherIconName, () => Promise<{ default: unknown }>> = {
  'clear-day': () => import('./clear-day.json'),
  'clear-night': () => import('./clear-night.json'),
  'overcast-day': () => import('./overcast-day.json'),
  'overcast-night': () => import('./overcast-night.json'),
  'fog-day': () => import('./fog-day.json'),
  'fog-night': () => import('./fog-night.json'),
  drizzle: () => import('./drizzle.json'),
  'rain-day': () => import('./rain-day.json'),
  'rain-night': () => import('./rain-night.json'),
  snow: () => import('./snow.json'),
  'thunderstorms-day-rain': () => import('./thunderstorms-day-rain.json'),
  'thunderstorms-night-rain': () => import('./thunderstorms-night-rain.json'),
  hurricane: () => import('./hurricane.json'),
}

/** 懶載入該圖示的 Lottie 資料（回 null 表示未知名稱）。 */
export async function loadWeatherIconData(name: WeatherIconName): Promise<unknown | null> {
  const loader = LOADERS[name]
  if (!loader) return null
  const mod = await loader()
  return mod.default ?? null
}
