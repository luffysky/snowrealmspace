import { weatherCodeToCondition, type WeatherCondition } from '@snowrealm/validation'

/**
 * 天氣抓取的共用 client 端邏輯（#56）。**client-safe，不含 'use server'。**
 *
 * 資料流（重要）：伺服器 /api/weather **只回城市名**，天氣本身由**瀏覽器**去查 —— 因為
 * Zeabur gateway 連 Open-Meteo 不穩會回 502，而瀏覽器連得到（Open-Meteo 公開＋開放 CORS）。
 * 所以這裡在 client 端依序打兩支公開端點：geocode（城市→座標）→ forecast（座標→天氣）。
 *
 * 這份由 WeatherWidget 與 WeatherDateTimeWidget 共用（同一套抓取，不重複實作）。
 */

// client 端查到的天氣
export type Weather = { place: string; tempC: number; isDay: boolean; condition: WeatherCondition }

export const CONDITION_LABEL: Record<WeatherCondition, string> = {
  clear: '晴',
  cloudy: '多雲',
  fog: '霧',
  drizzle: '毛毛雨',
  rain: '雨',
  snow: '雪',
  thunder: '雷雨',
  typhoon: '颱風',
}

export const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search'
export const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
// 瀏覽器端逾時：不經過任何 gateway，可放寬（6s）。連得到就成功，連不到就顯示可讀原因。
export const CLIENT_TIMEOUT_MS = 6000

export type GeoRaw = {
  results?: { name: string; latitude: number; longitude: number; country?: string; admin1?: string }[]
}
export type ForecastRaw = {
  current?: { temperature_2m?: number; weather_code?: number; is_day?: number; wind_speed_10m?: number }
}

/**
 * 「台北, 臺灣」這樣的顯示字串（mirror @snowrealm/weather 的 displayPlace，純字串組裝）。
 * 有行政區就帶上、去重；最多兩段（城市 + 國家/區域），避免塞爆小卡片。
 */
export function displayPlace(name: string, admin1?: string, country?: string): string {
  const parts = [name, admin1, country].filter(
    (x, i, arr): x is string => Boolean(x) && arr.indexOf(x) === i,
  )
  return parts.length > 2 ? `${parts[0]}, ${parts[parts.length - 1]}` : parts.join(', ')
}

type GeoPlace = NonNullable<GeoRaw['results']>[number]

/** 對 Open-Meteo geocode 查一個名字，取第一筆。 */
export async function geocodeOne(name: string): Promise<GeoPlace | undefined> {
  const url = `${GEOCODE_URL}?name=${encodeURIComponent(name)}&count=1&language=zh&format=json`
  const res = await fetch(url, { signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS) })
  if (!res.ok) throw new Error(`地理編碼 HTTP ${res.status}`)
  const geo = (await res.json()) as GeoRaw
  return geo.results?.[0]
}

/** 瀏覽器端：城市名 → 目前天氣。查無城市回 'notfound'，上游失敗 throw（含可讀原因）。 */
export async function fetchWeatherInBrowser(city: string): Promise<Weather | 'notfound'> {
  // 1. geocode：城市 → 座標。Open-Meteo 對台灣「區」收錄不一（板橋區查得到、鶯歌區查不到
  //    但「鶯歌」查得到）——照原樣查一次，查無且結尾是行政區後綴（區/鄉/鎮/市）就去後綴再試。
  let place = await geocodeOne(city)
  if (!place) {
    const stripped = city.replace(/[區鄉鎮市]$/u, '').trim()
    if (stripped && stripped !== city) place = await geocodeOne(stripped)
  }
  if (!place) return 'notfound'

  // 2. forecast：座標 → 目前天氣
  const fcUrl =
    `${FORECAST_URL}?latitude=${place.latitude}&longitude=${place.longitude}` +
    '&current=temperature_2m,weather_code,is_day,wind_speed_10m&wind_speed_unit=kmh'
  const fcRes = await fetch(fcUrl, { signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS) })
  if (!fcRes.ok) throw new Error(`天氣查詢 HTTP ${fcRes.status}`)
  const fc = (await fcRes.json()) as ForecastRaw
  const cur = fc.current
  if (!cur || cur.temperature_2m === undefined || cur.weather_code === undefined) {
    throw new Error('天氣資料格式不符')
  }

  return {
    place: displayPlace(place.name, place.admin1, place.country),
    tempC: Math.round(cur.temperature_2m),
    isDay: cur.is_day !== 0,
    condition: weatherCodeToCondition(cur.weather_code, cur.wind_speed_10m ?? 0),
  }
}
