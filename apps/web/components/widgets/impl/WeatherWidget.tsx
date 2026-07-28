'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ProceduralScene } from '@/components/ProceduralScene'
import type { WeatherCondition } from '@snowrealm/validation'
import type { WidgetProps } from '../types'

/**
 * 天氣小工具（#56）。讀 /api/weather（帶 x-space-id），依 space 儲存的城市顯示目前天氣。
 *
 * 狀態誠實：未開啟 / 未設城市 / 城市查無 / 連不上 / 載入中都明說，不擺假資料。
 * 動畫用 ProceduralScene overlay（reduced-motion / 省流量已在該元件自動略過）；
 * 有動畫時提供暫停鈕（ADR-019）。不寫死顏色，chrome 一律用 --sr-* token。
 */

type Cfg = { showAnimation?: boolean }

// 後端回傳的聯合狀態
type Resp =
  | { enabled: false }
  | { enabled: true; configured: false }
  | { enabled: true; configured: true; found: false; city: string }
  | {
      enabled: true
      configured: true
      found: true
      place: string
      tempC: number
      isDay: boolean
      condition: WeatherCondition
      code: number
    }

type State = 'loading' | 'ready' | 'error'

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

export default function WeatherWidget({ spaceId, config }: WidgetProps) {
  const showAnimation = (config as Cfg | null)?.showAnimation ?? true
  const [state, setState] = useState<State>('loading')
  const [data, setData] = useState<Resp | null>(null)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    let alive = true
    setState('loading')
    fetch('/api/weather', { headers: { 'x-space-id': spaceId } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('http'))))
      .then((b: { data: Resp }) => {
        if (!alive) return
        setData(b.data)
        setState('ready')
      })
      .catch(() => {
        if (alive) setState('error')
      })
    return () => {
      alive = false
    }
  }, [spaceId])

  const cardStyle: React.CSSProperties = { position: 'relative', overflow: 'hidden' }
  const contentStyle: React.CSSProperties = { position: 'relative', zIndex: 1, minWidth: 0 }

  if (state === 'loading') {
    return (
      <div className="sr-card sr-widget" style={cardStyle} aria-busy="true">
        <h3 className="sr-widget-title">天氣</h3>
        <p className="sr-muted" style={{ margin: 0 }}>
          載入中…
        </p>
      </div>
    )
  }

  if (state === 'error' || !data) {
    return (
      <div className="sr-card sr-widget" style={cardStyle}>
        <h3 className="sr-widget-title">天氣</h3>
        <p className="sr-muted" style={{ margin: 0, color: 'var(--sr-danger)' }}>
          天氣讀取失敗，稍後再試。
        </p>
      </div>
    )
  }

  // 未開啟 → 引導去設定
  if (!data.enabled) {
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

  // 開了但沒設城市
  if (!data.configured) {
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

  // 城市查無此地
  if (!data.found) {
    return (
      <div className="sr-card sr-widget" style={cardStyle}>
        <h3 className="sr-widget-title">天氣</h3>
        <p className="sr-muted" style={{ margin: 0, overflowWrap: 'anywhere' }}>
          找不到「{data.city}」這個城市，請到{' '}
          <Link href="/settings" className="sr-link">
            設定
          </Link>{' '}
          改一個。
        </p>
      </div>
    )
  }

  // 有天氣資料
  const { sceneId, density } = sceneFor(data.condition, data.isDay)
  const animate = showAnimation && sceneId !== null
  const motif = data.isDay ? '☀' : '☾'

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
              {data.tempC}°C
            </div>
            <div className="sr-muted" style={{ overflowWrap: 'anywhere' }}>
              {CONDITION_LABEL[data.condition]}
              {data.isDay ? '（白天）' : '（夜晚）'}
            </div>
          </div>
        </div>

        <p className="sr-muted" style={{ margin: 0, overflowWrap: 'anywhere' }}>
          {data.place}
        </p>
      </div>
    </div>
  )
}
