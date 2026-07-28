'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ProceduralScene } from '@/components/ProceduralScene'
import { weatherCodeToCondition, type WeatherCondition } from '@snowrealm/validation'
import type { WidgetProps } from '../types'

/**
 * 天氣小工具（#56）。
 *
 * 資料流（重要）：伺服器 /api/weather **只回城市名**，天氣本身由**瀏覽器**去查 —— 因為
 * Zeabur gateway 連 Open-Meteo 不穩會回 502，而瀏覽器連得到（Open-Meteo 公開＋開放 CORS）。
 * 所以這裡在 client 端依序打兩支公開端點：geocode（城市→座標）→ forecast（座標→天氣）。
 *
 * 狀態誠實：未開啟 / 未設城市 / 城市查無 / 查詢失敗 / 載入中都明說，不擺假資料。
 * 動畫用 ProceduralScene overlay（reduced-motion / 省流量已在該元件自動略過）；
 * 有動畫時提供暫停鈕（ADR-019）。不寫死顏色，chrome 一律用 --sr-* token。
 */

type Cfg = { showAnimation?: boolean }

// /api/weather 的回傳（只含設定，不含天氣）
type Meta =
  | { enabled: false }
  | { enabled: true; configured: false }
  | { enabled: true; configured: true; city: string }

// client 端查到的天氣
type Weather = { place: string; tempC: number; isDay: boolean; condition: WeatherCondition }

/**
 * 目前的畫面狀態（單一 discriminated union，避免多個 boolean 交錯）。
 *   loading      → 讀 /api/weather 中
 *   meta-error   → /api/weather 讀取失敗
 *   disabled     → 沒開天氣
 *   not-configured → 開了但沒設城市
 *   wx-loading   → 已拿到城市，瀏覽器查天氣中
 *   wx-notfound  → geocode 查無此城市
 *   wx-error     → 瀏覽器查天氣失敗（可讀原因）
 *   wx-ready     → 有天氣資料
 */
type View =
  | { kind: 'loading' }
  | { kind: 'meta-error'; msg: string }
  | { kind: 'disabled' }
  | { kind: 'not-configured' }
  | { kind: 'wx-loading' }
  | { kind: 'wx-notfound'; city: string }
  | { kind: 'wx-error'; msg: string }
  | { kind: 'wx-ready'; weather: Weather }

const CONDITION_LABEL: Record<WeatherCondition, string> = {
  clear: '晴',
  cloudy: '多雲',
  fog: '霧',
  drizzle: '毛毛雨',
  rain: '雨',
  snow: '雪',
  thunder: '雷雨',
  typhoon: '颱風',
}

const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
// 瀏覽器端逾時：不經過任何 gateway，可放寬（6s）。連得到就成功，連不到就顯示可讀原因。
const CLIENT_TIMEOUT_MS = 6000

type GeoRaw = {
  results?: { name: string; latitude: number; longitude: number; country?: string; admin1?: string }[]
}
type ForecastRaw = {
  current?: { temperature_2m?: number; weather_code?: number; is_day?: number; wind_speed_10m?: number }
}

/**
 * 「台北, 臺灣」這樣的顯示字串（mirror @snowrealm/weather 的 displayPlace，純字串組裝）。
 * 有行政區就帶上、去重；最多兩段（城市 + 國家/區域），避免塞爆小卡片。
 */
function displayPlace(name: string, admin1?: string, country?: string): string {
  const parts = [name, admin1, country].filter(
    (x, i, arr): x is string => Boolean(x) && arr.indexOf(x) === i,
  )
  return parts.length > 2 ? `${parts[0]}, ${parts[parts.length - 1]}` : parts.join(', ')
}

/**
 * condition（+ 日/夜）→ 既有場景（lib/scenes.ts 的 id）與密度。純資料對應、不改渲染器。
 * 註：晴天用 overlay 時，靜態場景（sunburst/sky-day）疊上去看不見，因此：
 *   晴・日 → 'dust-gold'（暖色漂浮微粒，當作陽光微塵）；晴・夜 → 'stars'（星空閃爍）。
 *   多雲沒有對應的粒子場景（陰天本就無落物），故不放動畫、只以日/月字符表示。
 */
function sceneFor(condition: WeatherCondition, isDay: boolean): { sceneId: string | null; density: number } {
  switch (condition) {
    case 'clear':
      return isDay ? { sceneId: 'dust-gold', density: 1 } : { sceneId: 'stars', density: 1 }
    case 'cloudy':
      return { sceneId: null, density: 1 }
    case 'fog':
      return { sceneId: 'ash', density: 1 }
    case 'drizzle':
      return { sceneId: 'rain-soft', density: 1 }
    case 'rain':
      return { sceneId: 'rain-heavy', density: 1 }
    case 'snow':
      return { sceneId: 'snow-soft', density: 1 }
    case 'thunder':
      return { sceneId: 'rain-storm', density: 1.4 }
    case 'typhoon':
      return { sceneId: 'rain-storm', density: 1.8 }
  }
}

type GeoPlace = NonNullable<GeoRaw['results']>[number]

/** 對 Open-Meteo geocode 查一個名字，取第一筆。 */
async function geocodeOne(name: string): Promise<GeoPlace | undefined> {
  const url = `${GEOCODE_URL}?name=${encodeURIComponent(name)}&count=1&language=zh&format=json`
  const res = await fetch(url, { signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS) })
  if (!res.ok) throw new Error(`地理編碼 HTTP ${res.status}`)
  const geo = (await res.json()) as GeoRaw
  return geo.results?.[0]
}

/** 瀏覽器端：城市名 → 目前天氣。查無城市回 'notfound'，上游失敗 throw（含可讀原因）。 */
async function fetchWeatherInBrowser(city: string): Promise<Weather | 'notfound'> {
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

export default function WeatherWidget({ spaceId, config }: WidgetProps) {
  const showAnimation = (config as Cfg | null)?.showAnimation ?? true
  const [view, setView] = useState<View>({ kind: 'loading' })
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    let alive = true
    setView({ kind: 'loading' })

    void (async () => {
      // 1. 先向伺服器要城市名（立即回應，不會 502）
      let meta: Meta
      try {
        const r = await fetch('/api/weather', { headers: { 'x-space-id': spaceId } })
        if (!r.ok) {
          const body = (await r.json().catch(() => null)) as { error?: { message?: string } } | null
          throw new Error(body?.error?.message ? `${r.status}：${body.error.message}` : `HTTP ${r.status}`)
        }
        meta = ((await r.json()) as { data: Meta }).data
      } catch (e: unknown) {
        if (alive) setView({ kind: 'meta-error', msg: e instanceof Error ? e.message : '未知錯誤' })
        return
      }
      if (!alive) return

      if (!meta.enabled) return setView({ kind: 'disabled' })
      if (!meta.configured) return setView({ kind: 'not-configured' })

      // 2. 瀏覽器自己查天氣（Open-Meteo 公開端點）
      setView({ kind: 'wx-loading' })
      try {
        const wx = await fetchWeatherInBrowser(meta.city)
        if (!alive) return
        if (wx === 'notfound') setView({ kind: 'wx-notfound', city: meta.city })
        else setView({ kind: 'wx-ready', weather: wx })
      } catch (e: unknown) {
        if (alive) setView({ kind: 'wx-error', msg: e instanceof Error ? e.message : '未知錯誤' })
      }
    })()

    return () => {
      alive = false
    }
  }, [spaceId])

  const cardStyle: React.CSSProperties = { position: 'relative', overflow: 'hidden' }
  const contentStyle: React.CSSProperties = { position: 'relative', zIndex: 1, minWidth: 0 }

  // ── 非天氣資料的各種狀態（同一張卡片外框）─────────────────────
  if (view.kind === 'loading' || view.kind === 'wx-loading') {
    return (
      <div className="sr-card sr-widget" style={cardStyle} aria-busy="true">
        <h3 className="sr-widget-title">天氣</h3>
        <p className="sr-muted" style={{ margin: 0 }}>
          載入中…
        </p>
      </div>
    )
  }

  if (view.kind === 'meta-error' || view.kind === 'wx-error') {
    return (
      <div className="sr-card sr-widget" style={cardStyle}>
        <h3 className="sr-widget-title">天氣</h3>
        <p className="sr-muted" style={{ margin: 0, color: 'var(--sr-danger)', overflowWrap: 'anywhere' }}>
          天氣讀取失敗：{view.msg}
        </p>
      </div>
    )
  }

  if (view.kind === 'disabled') {
    return (
      <div className="sr-card sr-widget" style={cardStyle}>
        <h3 className="sr-widget-title">天氣</h3>
        <p className="sr-muted" style={{ margin: 0 }}>
          還沒開啟天氣。到{' '}
          <Link href="/settings" className="sr-link">
            設定
          </Link>{' '}
          開啟並選一個城市。
        </p>
      </div>
    )
  }

  if (view.kind === 'not-configured') {
    return (
      <div className="sr-card sr-widget" style={cardStyle}>
        <h3 className="sr-widget-title">天氣</h3>
        <p className="sr-muted" style={{ margin: 0 }}>
          還沒設定城市。到{' '}
          <Link href="/settings" className="sr-link">
            設定
          </Link>{' '}
          填入城市或使用目前位置。
        </p>
      </div>
    )
  }

  if (view.kind === 'wx-notfound') {
    return (
      <div className="sr-card sr-widget" style={cardStyle}>
        <h3 className="sr-widget-title">天氣</h3>
        <p className="sr-muted" style={{ margin: 0, overflowWrap: 'anywhere' }}>
          找不到「{view.city}」這個城市，請到{' '}
          <Link href="/settings" className="sr-link">
            設定
          </Link>{' '}
          改一個。
        </p>
      </div>
    )
  }

  // ── 有天氣資料 ────────────────────────────────────────────
  const { weather } = view
  const { sceneId, density } = sceneFor(weather.condition, weather.isDay)
  const animate = showAnimation && sceneId !== null
  const motif = weather.isDay ? '☀' : '☾'

  return (
    <div className="sr-card sr-widget" style={cardStyle}>
      {animate && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }} aria-hidden="true">
          <ProceduralScene sceneId={sceneId} density={density} overlay paused={paused} />
        </div>
      )}

      <div className="sr-widget" style={{ ...contentStyle, height: 'auto', gap: 'var(--sr-space-2)', overflow: 'visible' }}>
        <div className="sr-row" style={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--sr-space-2)' }}>
          <h3 className="sr-widget-title">天氣</h3>
          {animate && (
            <button
              type="button"
              className="sr-button sr-button-secondary"
              style={{ flexShrink: 0, padding: '2px 8px', fontSize: 'var(--sr-text-sm)' }}
              aria-pressed={paused}
              onClick={() => setPaused((p) => !p)}
            >
              {paused ? '▶ 播放' : '❚❚ 暫停'}
            </button>
          )}
        </div>

        <div className="sr-row" style={{ alignItems: 'center', gap: 'var(--sr-space-3)', minWidth: 0 }}>
          <span aria-hidden="true" style={{ fontSize: '2rem', lineHeight: 1, flexShrink: 0 }}>
            {motif}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 'var(--sr-text-h1)', fontWeight: 700, lineHeight: 1.1 }}>
              {weather.tempC}°C
            </div>
            <div className="sr-muted" style={{ overflowWrap: 'anywhere' }}>
              {CONDITION_LABEL[weather.condition]}
              {weather.isDay ? '（白天）' : '（夜晚）'}
            </div>
          </div>
        </div>

        <p className="sr-muted" style={{ margin: 0, overflowWrap: 'anywhere' }}>
          {weather.place}
        </p>
      </div>
    </div>
  )
}
