'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { WeatherLottie } from './WeatherLottie'
import { CONDITION_LABEL, fetchWeatherInBrowser, type Weather } from '@/lib/weather-client'
import {
  gregorianText,
  lunarText,
  rocText,
  safeFormat,
  timeOptions,
  type TimeStyle,
} from '@/lib/datetime-format'
import type { WidgetProps } from '../types'

/**
 * 天氣＋時間（合併小工具）。一張卡：上半是時間/日期，下半是天氣。
 *
 * 重點：**兩半各自獨立**。
 *  - 時間半段全走瀏覽器 Intl（同 @/lib/datetime-format），**不需要天氣 API**，故永遠可用。
 *  - 天氣半段走 @/lib/weather-client（同 WeatherWidget 的兩步抓取：先 GET /api/weather 取城市名，
 *    再由瀏覽器查 Open-Meteo）。若天氣 flag 關（/api/weather 回 enabled:false）→ 天氣半段靜默隱藏，
 *    時間半段照常顯示（優雅降級，不讓整個 widget 失效）。未設城市/查無/失敗都以誠實的小提示呈現。
 *
 * 指針鐘面不在此 widget（只用數位時間）。SSR/hydration：now 初始 null，掛載後才 tick。
 * chrome 顏色一律 --sr-* token；容器 min-width:0 + overflow-wrap 防溢出（CLAUDE.md #5/#9）。
 */

type Cfg = {
  showWeather?: boolean
  animSpeed?: number
  showTime?: boolean
  timeStyle?: TimeStyle
  showGregorian?: boolean
  showWeekday?: boolean
  showRoc?: boolean
  showLunar?: boolean
}

// /api/weather 的回傳（只含設定，不含天氣）
type Meta =
  | { enabled: false }
  | { enabled: true; configured: false }
  | { enabled: true; configured: true; city: string }

/**
 * 天氣半段的狀態（時間半段永遠獨立於此）。
 *   off            → 使用者關掉天氣，或天氣 flag 關（enabled:false）→ 完全不渲染天氣半段
 *   loading        → 讀 /api/weather / 查天氣中
 *   not-configured → 開了但沒設城市（可行動的小提示）
 *   notfound       → geocode 查無此城市
 *   error          → 讀取失敗（可讀原因）
 *   ready          → 有天氣資料
 */
type WxView =
  | { kind: 'off' }
  | { kind: 'loading' }
  | { kind: 'not-configured' }
  | { kind: 'notfound'; city: string }
  | { kind: 'error'; msg: string }
  | { kind: 'ready'; weather: Weather }

export default function WeatherDateTimeWidget({ spaceId, config }: WidgetProps) {
  const cfg = (config as Cfg | null) ?? {}
  const showWeather = cfg.showWeather ?? true
  const animSpeed = cfg.animSpeed ?? 1.4
  const showTime = cfg.showTime ?? true
  const timeStyle: TimeStyle = cfg.timeStyle ?? '24 時（時:分）'
  const showGregorian = cfg.showGregorian ?? true
  const showWeekday = cfg.showWeekday ?? true
  const showRoc = cfg.showRoc ?? false
  const showLunar = cfg.showLunar ?? false

  // null 直到 client 首次 tick —— 避免 SSR/hydration mismatch。
  const [now, setNow] = useState<Date | null>(null)
  const [wx, setWx] = useState<WxView>(showWeather ? { kind: 'loading' } : { kind: 'off' })

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!showWeather) {
      setWx({ kind: 'off' })
      return
    }
    let alive = true
    setWx({ kind: 'loading' })

    void (async () => {
      // 1. 先向伺服器要城市名（立即回應，不會 502）
      let meta: Meta
      try {
        const r = await fetch('/api/weather', { headers: { 'x-space-id': spaceId } })
        // 天氣 feature flag 關閉時整條路由回 404（ADR-018，非假關閉）→ 天氣半段靜默隱藏，
        // 時間半段照常。這是本 widget 相對於 WeatherWidget 的關鍵優雅降級。
        if (r.status === 404) {
          if (alive) setWx({ kind: 'off' })
          return
        }
        if (!r.ok) {
          const body = (await r.json().catch(() => null)) as { error?: { message?: string } } | null
          throw new Error(body?.error?.message ? `${r.status}：${body.error.message}` : `HTTP ${r.status}`)
        }
        meta = ((await r.json()) as { data: Meta }).data
      } catch (e: unknown) {
        if (alive) setWx({ kind: 'error', msg: e instanceof Error ? e.message : '未知錯誤' })
        return
      }
      if (!alive) return

      // 天氣 flag 關 → 天氣半段靜默隱藏（時間半段照常）
      if (!meta.enabled) return setWx({ kind: 'off' })
      if (!meta.configured) return setWx({ kind: 'not-configured' })

      // 2. 瀏覽器自己查天氣（Open-Meteo 公開端點）
      try {
        const w = await fetchWeatherInBrowser(meta.city)
        if (!alive) return
        if (w === 'notfound') setWx({ kind: 'notfound', city: meta.city })
        else setWx({ kind: 'ready', weather: w })
      } catch (e: unknown) {
        if (alive) setWx({ kind: 'error', msg: e instanceof Error ? e.message : '未知錯誤' })
      }
    })()

    return () => {
      alive = false
    }
  }, [spaceId, showWeather])

  // 掛載前的占位：server 與 client 首幀一致。
  if (!now) {
    return (
      <div className="sr-card sr-widget" style={{ minWidth: 0 }}>
        <h3 className="sr-widget-title">天氣＋時間</h3>
        <p className="sr-muted" style={{ margin: 0 }}>
          載入中…
        </p>
      </div>
    )
  }

  // ── 時間半段（裝置本地時區 = 當地時間；數位時間，無指針）──
  const timeText = showTime ? safeFormat('zh-TW', timeOptions(timeStyle), now) : null

  let gregorianLine: string | null = null
  if (showGregorian) gregorianLine = gregorianText(now, showWeekday)
  else if (showWeekday) gregorianLine = safeFormat('zh-TW', { weekday: 'long' }, now)

  const rocLine: string | null = showRoc ? rocText(now) : null
  const lunarLine: string | null = showLunar ? lunarText(now) : null
  const dateLines = [gregorianLine, rocLine, lunarLine].filter((x): x is string => x !== null)

  const hasTimeBlock = timeText !== null || dateLines.length > 0

  return (
    <div className="sr-card sr-widget sr-weather-scale" style={{ minWidth: 0 }}>
      {/* ── 時間 / 日期 ── */}
      {timeText && (
        <div
          style={{
            fontSize: 'var(--sr-text-h1)',
            fontWeight: 700,
            lineHeight: 1.1,
            fontVariantNumeric: 'tabular-nums',
            minWidth: 0,
            overflowWrap: 'anywhere',
          }}
        >
          {timeText}
        </div>
      )}

      {dateLines.length > 0 && (
        <div
          className="sr-muted"
          style={{ marginTop: 'var(--sr-space-1)', minWidth: 0, overflowWrap: 'anywhere', lineHeight: 1.5 }}
        >
          {dateLines.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      )}

      {/* ── 天氣半段 ── */}
      <WeatherHalf wx={wx} animSpeed={animSpeed} withDivider={hasTimeBlock} />

      {!hasTimeBlock && wx.kind === 'off' && (
        <p className="sr-muted" style={{ margin: 0 }}>
          時間與天氣都沒有要顯示的內容，到設定勾選。
        </p>
      )}
    </div>
  )
}

/** 天氣半段：'off' 完全不渲染；其餘狀態緊湊呈現。時間半段永遠不受這裡影響。 */
function WeatherHalf({
  wx,
  animSpeed,
  withDivider,
}: {
  wx: WxView
  animSpeed: number
  withDivider: boolean
}) {
  if (wx.kind === 'off') return null

  const wrapStyle: React.CSSProperties = {
    minWidth: 0,
    ...(withDivider
      ? {
          marginTop: 'var(--sr-space-2)',
          paddingTop: 'var(--sr-space-2)',
          borderTop: '1px solid var(--sr-border)',
        }
      : {}),
  }

  if (wx.kind === 'loading') {
    return (
      <div style={wrapStyle} aria-busy="true">
        <p className="sr-muted" style={{ margin: 0 }}>
          天氣載入中…
        </p>
      </div>
    )
  }

  if (wx.kind === 'not-configured') {
    return (
      <div style={wrapStyle}>
        <p className="sr-muted" style={{ margin: 0, overflowWrap: 'anywhere' }}>
          還沒設定城市。到{' '}
          <Link href="/settings" className="sr-link">
            設定
          </Link>{' '}
          填入城市即可顯示天氣。
        </p>
      </div>
    )
  }

  if (wx.kind === 'notfound') {
    return (
      <div style={wrapStyle}>
        <p className="sr-muted" style={{ margin: 0, overflowWrap: 'anywhere' }}>
          找不到「{wx.city}」這個城市，請到{' '}
          <Link href="/settings" className="sr-link">
            設定
          </Link>{' '}
          改一個。
        </p>
      </div>
    )
  }

  if (wx.kind === 'error') {
    return (
      <div style={wrapStyle}>
        <p className="sr-muted" style={{ margin: 0, color: 'var(--sr-danger)', overflowWrap: 'anywhere' }}>
          天氣讀取失敗：{wx.msg}
        </p>
      </div>
    )
  }

  // ── 有天氣資料 ──
  const { weather } = wx
  return (
    <div style={wrapStyle}>
      <div className="sr-row" style={{ alignItems: 'center', gap: 'var(--sr-space-3)', minWidth: 0 }}>
        {/* 圖示用容器查詢單位(cqi)，widget 放越大跟著等比放大 */}
        <WeatherLottie
          condition={weather.condition}
          isDay={weather.isDay}
          size="clamp(44px, 26cqi, 120px)"
          animSpeed={animSpeed}
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 'clamp(1.3rem, 14cqi, 3rem)', fontWeight: 700, lineHeight: 1.1 }}>
            {weather.tempC}°C
          </div>
          <div className="sr-muted" style={{ overflowWrap: 'anywhere' }}>
            {CONDITION_LABEL[weather.condition]}
            {weather.isDay ? '（白天）' : '（夜晚）'}
          </div>
        </div>
      </div>
      <p className="sr-muted" style={{ margin: 'var(--sr-space-1) 0 0', overflowWrap: 'anywhere' }}>
        {weather.place}
      </p>
    </div>
  )
}
