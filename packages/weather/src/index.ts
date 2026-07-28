import { weatherCodeToCondition, type WeatherCondition } from '@snowrealm/validation'

/**
 * 天氣 provider 存取層（Open-Meteo，無需金鑰）。
 *
 * 分層：這是共用套件，只依賴 @snowrealm/validation（純對應）。兩個消費端都 import 得到：
 *   - apps/web 的 /api/weather route（Node runtime，開頁時查天氣顯示小卡）。
 *   - packages/daily-engine（#49，worker/cron 依天氣挑內容）。
 * 以前 fetch 邏輯放在 apps/web/lib，但套件不能反向 import app，故上提到這裡。
 *
 * 只在伺服器端呼叫。純資料抓取 + 記憶體快取，對外錯誤一律 throw，
 * 由呼叫端決定如何處理（route 轉成 PROVIDER_ERROR；daily-engine 吞掉當「無天氣 tag」）。
 *
 * 隱私：我們只儲存城市「名稱」，座標僅在上游請求當下使用、不落地、不進我們自己的 log/URL。
 */

const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
// 反向地理編碼（座標 → 城市名）：Open-Meteo 只提供「名稱→座標」，沒有反查。
// 「使用目前位置」需要把座標換成一個可儲存的城市名，改用 BigDataCloud 的免金鑰端點。
const REVERSE_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client'

const TIMEOUT_MS = 8000

export type GeoPlace = {
  name: string
  latitude: number
  longitude: number
  country?: string
  admin1?: string
}

export type WeatherNow = {
  place: string
  tempC: number
  isDay: boolean
  condition: WeatherCondition
  code: number
}

/** 「台北, 臺灣」這樣的顯示字串（有行政區就帶上，去除重複）。 */
export function displayPlace(p: GeoPlace): string {
  const parts = [p.name, p.admin1, p.country].filter(
    (x, i, arr): x is string => Boolean(x) && arr.indexOf(x) === i,
  )
  // 只保留最多兩段（城市 + 國家/區域），避免過長塞爆小卡片
  return parts.length > 2 ? `${parts[0]}, ${parts[parts.length - 1]}` : parts.join(', ')
}

type GeoRaw = {
  results?: {
    name: string
    latitude: number
    longitude: number
    country?: string
    admin1?: string
  }[]
}

/** 城市名 → 座標與顯示資訊。找不到回 null（非錯誤）；上游失敗才 throw。 */
export async function geocodeCity(city: string): Promise<GeoPlace | null> {
  const url = `${GEOCODE_URL}?name=${encodeURIComponent(city)}&count=1&language=zh&format=json`
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error('[weather] 地理編碼失敗', res.status, detail.slice(0, 200))
    throw new Error(`geocode ${res.status}`)
  }
  const body = (await res.json()) as GeoRaw
  const r = body.results?.[0]
  if (!r) return null
  return {
    name: r.name,
    latitude: r.latitude,
    longitude: r.longitude,
    ...(r.country ? { country: r.country } : {}),
    ...(r.admin1 ? { admin1: r.admin1 } : {}),
  }
}

/** 一筆城市搜尋建議：GeoPlace 加上預先算好的顯示字串（如「信義區, 臺灣」）。 */
export type GeoSuggestion = GeoPlace & { displayName: string }

/**
 * 城市自動完成搜尋：一個查詢字串 → 最多 8 筆建議（mirror geocodeCity 但 count=8）。
 *
 * 涵蓋台灣縣市/區、外島（澎湖/金門/馬祖）與任何國外城市，名稱走 language=zh 在地化，
 * 不需維護巨大的靜態清單。查無結果回空陣列（非錯誤）；上游失敗才 throw。
 * 少於 2 字直接回空陣列（呼叫端也應 debounce，避免每個按鍵都打上游）。
 */
export async function searchCities(query: string): Promise<GeoSuggestion[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const url = `${GEOCODE_URL}?name=${encodeURIComponent(q)}&count=8&language=zh&format=json`
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error('[weather] 城市搜尋失敗', res.status, detail.slice(0, 200))
    throw new Error(`search ${res.status}`)
  }
  const body = (await res.json()) as GeoRaw
  return (body.results ?? []).map((r) => {
    const place: GeoPlace = {
      name: r.name,
      latitude: r.latitude,
      longitude: r.longitude,
      ...(r.country ? { country: r.country } : {}),
      ...(r.admin1 ? { admin1: r.admin1 } : {}),
    }
    return { ...place, displayName: displayPlace(place) }
  })
}

type ReverseRaw = { city?: string; locality?: string; principalSubdivision?: string; countryName?: string }

/** 座標 → 城市名（供「使用目前位置」把定位換成可儲存的名稱）。找不到回 null。 */
export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  const url = `${REVERSE_URL}?latitude=${lat}&longitude=${lon}&localityLanguage=zh`
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) {
    console.error('[weather] 反向地理編碼失敗', res.status)
    throw new Error(`reverse ${res.status}`)
  }
  const body = (await res.json()) as ReverseRaw
  return body.city || body.locality || body.principalSubdivision || null
}

type ForecastRaw = {
  current?: {
    temperature_2m?: number
    weather_code?: number
    is_day?: number
    wind_speed_10m?: number
  }
}

export type Forecast = { tempC: number; code: number; isDay: boolean; windKmh: number }

/** 座標 → 目前天氣。上游失敗或缺欄位皆 throw。 */
export async function fetchForecast(lat: number, lon: number): Promise<Forecast> {
  const url =
    `${FORECAST_URL}?latitude=${lat}&longitude=${lon}` +
    '&current=temperature_2m,weather_code,is_day,wind_speed_10m&wind_speed_unit=kmh'
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error('[weather] 預報失敗', res.status, detail.slice(0, 200))
    throw new Error(`forecast ${res.status}`)
  }
  const body = (await res.json()) as ForecastRaw
  const cur = body.current
  if (!cur || cur.temperature_2m === undefined || cur.weather_code === undefined) {
    throw new Error('forecast payload missing current')
  }
  return {
    tempC: cur.temperature_2m,
    code: cur.weather_code,
    isDay: cur.is_day !== 0,
    windKmh: cur.wind_speed_10m ?? 0,
  }
}

// ── 每城市記憶體快取（~10 分鐘 TTL）──────────────────────────
// 天氣不需要即時；快取降低上游負載，也避免每次開首頁都打外部 API。
const CACHE_TTL_MS = 10 * 60_000
const MAX_ENTRIES = 200
const cache = new Map<string, { at: number; value: WeatherNow }>()

function cacheGet(key: string): WeatherNow | null {
  const hit = cache.get(key)
  if (!hit) return null
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key)
    return null
  }
  return hit.value
}

function cacheSet(key: string, value: WeatherNow): void {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, { at: Date.now(), value })
}

/**
 * 城市名 → 目前天氣（含快取）。城市查無此地回 null。
 * 對應到固定 condition 列舉在這裡完成（純函式 weatherCodeToCondition）。
 */
export async function weatherForCity(city: string): Promise<WeatherNow | null> {
  const key = city.trim().toLowerCase()
  const cached = cacheGet(key)
  if (cached) return cached

  const place = await geocodeCity(city)
  if (!place) return null
  const fc = await fetchForecast(place.latitude, place.longitude)
  const value: WeatherNow = {
    place: displayPlace(place),
    tempC: Math.round(fc.tempC),
    isDay: fc.isDay,
    condition: weatherCodeToCondition(fc.code, fc.windKmh),
    code: fc.code,
  }
  cacheSet(key, value)
  return value
}

/** 座標 → 目前天氣（供 lookup 用；不寫入城市快取，因為 key 是城市名）。 */
export async function weatherForCoords(lat: number, lon: number): Promise<Omit<WeatherNow, 'place'>> {
  const fc = await fetchForecast(lat, lon)
  return {
    tempC: Math.round(fc.tempC),
    isDay: fc.isDay,
    condition: weatherCodeToCondition(fc.code, fc.windKmh),
    code: fc.code,
  }
}
