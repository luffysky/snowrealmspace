import { z } from 'zod'

/**
 * 天氣的純對應邏輯（無副作用、無 I/O）。
 *
 * 放在 @snowrealm/validation 的理由（分層）：
 *   - apps/web 的 /api/weather route 要把 provider 的 WMO code 轉成固定 enum。
 *   - packages/daily-engine（#49，之後的內容挑選）要把 enum 轉成既有的內容 tag。
 * 兩個消費端都已經依賴 @snowrealm/validation，而 validation 不依賴任何 app，
 * 把純對應放這裡兩邊都 import 得到，且不會違反 dependency-cruiser 的分層規則。
 *
 * 這裡只做「值 → 值」的對應，不碰 fetch / DB / 座標；隱私相關的東西留在 route。
 */

/** 固定的天氣狀態列舉。provider 的細分代碼一律收斂到這幾類，UI 與內容只認這個。 */
export type WeatherCondition =
  | 'clear'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'thunder'
  | 'typhoon'

export const WEATHER_CONDITIONS = [
  'clear',
  'cloudy',
  'fog',
  'drizzle',
  'rain',
  'snow',
  'thunder',
  'typhoon',
] as const

/**
 * 判為「颱風」的風速門檻（km/h）。
 *
 * 假設：這裡取蒲福風級約 10 級（暴風，≈89 km/h）為界 —— 在有雨或雷的狀態下，
 * 風速達此門檻視為 typhoon。真正的颱風定義依各國警報系統而異，這是給視覺/內容
 * 用的粗略啟發式，不是氣象判定。晴天再大風也不會變颱風（沒有降水結構）。
 */
export const TYPHOON_WIND_KMH = 89

/**
 * WMO weather interpretation code → 固定狀態列舉。
 * 代碼表見 Open-Meteo 文件（WMO 4677 子集）：
 *   0 晴 / 1 大致晴 / 2 局部多雲 / 3 陰
 *   45,48 霧
 *   51,53,55 毛毛雨；56,57 凍毛雨
 *   61,63,65 雨；66,67 凍雨；80,81,82 陣雨
 *   71,73,75 雪；77 雪珠；85,86 陣雪
 *   95 雷雨；96,99 伴冰雹雷雨
 *
 * 假設：0 與 1 都當 clear（大致晴仍以晴為主視覺）；2、3 當 cloudy。
 * 雨或雷 + 風速 ≥ TYPHOON_WIND_KMH → typhoon。未知代碼降級為 clear（最溫和、不誤導）。
 */
export function weatherCodeToCondition(code: number, windSpeedKmh: number): WeatherCondition {
  const wind = Number.isFinite(windSpeedKmh) ? windSpeedKmh : 0

  // 雷雨（含冰雹，WMO 95–99）—— 高風速升級為颱風
  if (code >= 95 && code <= 99) return wind >= TYPHOON_WIND_KMH ? 'typhoon' : 'thunder'

  // 雨（含凍雨與陣雨）—— 高風速升級為颱風
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
    return wind >= TYPHOON_WIND_KMH ? 'typhoon' : 'rain'
  }

  // 雪（含雪珠與陣雪）
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'

  // 毛毛雨（含凍毛雨）
  if (code >= 51 && code <= 57) return 'drizzle'

  // 霧
  if (code === 45 || code === 48) return 'fog'

  // 多雲 / 陰
  if (code === 2 || code === 3) return 'cloudy'

  // 晴（0 晴、1 大致晴）與未知代碼
  return 'clear'
}

/**
 * 狀態 + 氣溫 → 既有的內容 tag（小寫 slug，符合 seasonalSchema 的 `^[a-z0-9_]+$`）。
 *
 * 供 #49（daily-engine 依天氣挑內容）使用。這裡先提供純函式與測試，
 * 本任務不接內容挑選。氣溫再加冷/熱 tag：<12 → cold、>30 → hot。
 *
 * 註：列舉不帶日/夜資訊（簽名只有 condition + tempC），故 clear 一律對到 sunny。
 */
export function conditionToContentTags(condition: WeatherCondition, tempC: number): string[] {
  const tags: string[] = []
  switch (condition) {
    case 'clear':
      tags.push('sunny')
      break
    case 'cloudy':
      tags.push('cloudy')
      break
    case 'fog':
      tags.push('foggy')
      break
    case 'drizzle':
    case 'rain':
      tags.push('rainy')
      break
    case 'snow':
      tags.push('snowy')
      break
    case 'thunder':
      tags.push('thunder')
      break
    case 'typhoon':
      tags.push('typhoon')
      break
  }
  if (Number.isFinite(tempC)) {
    if (tempC < 12) tags.push('cold')
    else if (tempC > 30) tags.push('hot')
  }
  return tags
}

/** 城市名稱：修剪、上限 80 字，空字串視為未設定（null）。設定與查詢共用。 */
export const weatherCitySchema = z
  .string()
  .trim()
  .max(80, '城市名稱太長了。')
  .transform((v) => (v.length === 0 ? null : v))
  .nullable()

/** POST /api/weather/lookup 的請求 body：城市名，或瀏覽器定位得到的座標（座標只進 body、不進 URL）。 */
export const weatherLookupSchema = z
  .object({
    city: z.string().trim().max(80).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lon: z.number().min(-180).max(180).optional(),
  })
  .refine((v) => (typeof v.city === 'string' && v.city.length > 0) || (v.lat !== undefined && v.lon !== undefined), {
    message: '請提供城市名稱，或座標（lat/lon）。',
  })

export type WeatherLookupInput = z.infer<typeof weatherLookupSchema>

/**
 * POST /api/weather/search 的請求 body：城市自動完成的查詢字串。
 * 最少 2 字（避免一輸入就打上游、回一堆雜訊）；上限 80 字。查詢字串只進 body、不進 URL。
 */
export const weatherSearchSchema = z.object({
  query: z.string().trim().min(2, '請至少輸入 2 個字。').max(80, '搜尋字串太長了。'),
})

export type WeatherSearchInput = z.infer<typeof weatherSearchSchema>
