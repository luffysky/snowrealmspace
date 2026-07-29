'use client'

import { useEffect, useState } from 'react'
import type { WidgetProps } from '../types'

/**
 * 時間日期：一個獨立小工具。即時走針的時鐘 + 可勾選的日期行
 * （西元年月日、星期、民國、農曆）。時間有幾種樣式可選。
 *
 * 全部日期換算走瀏覽器內建 Intl（民國 = roc 曆、農曆 = chinese 曆），
 * 不進網路、不取位置（permissions: []）。時間用裝置本地時區 = 使用者當地時間。
 *
 * SSR/hydration：時鐘的值每秒都在變，伺服器沒有穩定的「現在」——
 * 若在 server 就渲染時間，client 補水（hydrate）時值必然不同 → mismatch 警告。
 * 因此以 `now` 初始為 null，只在 client 掛載後的第一次 tick 才有值；
 * 在那之前只畫一個占位（標題 + 載入中…），server 與 client 首幀一致。
 *
 * 版面：時間放大（--sr-text-h1），日期行為 muted，緊湊；容器 min-width:0
 * 與 overflow-wrap:anywhere，確保任何寬度都不溢出格子（CLAUDE.md #5/#9）。
 * chrome 顏色一律用 --sr-* token。
 */

type TimeStyle =
  | '24 時（時:分）'
  | '24 時（時:分:秒）'
  | '12 時（上午/下午 時:分）'
  | '12 時（上午/下午 時:分:秒）'

type ClockKind = '電子' | '指針'
type ClockSkin = '經典' | '簡約' | '霓虹' | '粉彩' | '羅馬'

type Cfg = {
  showTime?: boolean
  clockKind?: ClockKind
  clockSkin?: ClockSkin
  timeStyle?: TimeStyle
  showGregorian?: boolean
  showWeekday?: boolean
  showRoc?: boolean
  showLunar?: boolean
}

/**
 * 指針鐘面的花色表。一個 skin → 一組顏色與旗標，SVG 依此畫。
 *
 * 顏色策略：基底表面/刻度/針身盡量用 --sr-* token（自動相容明暗主題）；
 * 「霓虹」「粉彩」需要固定調性，故用**美術常數**（art constants）——它們自帶
 * 完整的深/淺表面色，因此不論 app 目前是明或暗，鐘面本身都清楚可讀（不依賴主題 token）。
 *   經典 = 表面底 + accent 秒針 + 12 刻度
 *   簡約 = 無刻度、細針
 *   霓虹 = 深底 + 青/洋紅螢光針（drop-shadow 發光）
 *   粉彩 = 柔粉底 + 紫/桃色針
 *   羅馬 = 羅馬數字時標（Ⅰ Ⅱ … Ⅻ）取代刻度
 */
type SkinSpec = {
  face: string // 鐘面填色
  ring: string // 外框
  ticks: boolean // 是否畫 12 刻度
  tickColor: string
  numeral: 'none' | 'roman' // 時標樣式
  numeralColor: string
  hour: string
  minute: string
  second: string
  hub: string // 中心軸點
  thin: boolean // 細針（簡約）
  glow: boolean // 螢光發光（霓虹）
}

/* eslint-disable no-restricted-syntax -- 霓虹/粉彩是「花色美術常數」（art constants），
   自帶完整深/淺表面色以在明暗主題下都可讀，刻意不走 --sr-* token（本次需求明確允許 skin accent 為美術色）。
   其餘花色（經典/簡約/羅馬）仍一律使用 --sr-* token。 */
const SKINS: Record<ClockSkin, SkinSpec> = {
  經典: {
    face: 'var(--sr-surface)',
    ring: 'var(--sr-border)',
    ticks: true,
    tickColor: 'var(--sr-text)',
    numeral: 'none',
    numeralColor: 'var(--sr-text)',
    hour: 'var(--sr-text)',
    minute: 'var(--sr-text)',
    second: 'var(--sr-accent)',
    hub: 'var(--sr-accent)',
    thin: false,
    glow: false,
  },
  簡約: {
    face: 'var(--sr-surface)',
    ring: 'var(--sr-border)',
    ticks: false,
    tickColor: 'var(--sr-text)',
    numeral: 'none',
    numeralColor: 'var(--sr-text)',
    hour: 'var(--sr-text)',
    minute: 'var(--sr-text)',
    second: 'var(--sr-accent)',
    hub: 'var(--sr-text)',
    thin: true,
    glow: false,
  },
  // 美術常數：深藍黑底 + 青/洋紅螢光（自帶深底，明暗主題下都清楚）
  霓虹: {
    face: '#0b1020',
    ring: '#1de9b6',
    ticks: true,
    tickColor: '#1de9b6',
    numeral: 'none',
    numeralColor: '#1de9b6',
    hour: '#00e5ff',
    minute: '#1de9b6',
    second: '#ff4fd8',
    hub: '#ff4fd8',
    thin: false,
    glow: true,
  },
  // 美術常數：柔粉底 + 紫/桃色針（自帶淺底，明暗主題下都清楚）
  粉彩: {
    face: '#fdf2f8',
    ring: '#f9a8d4',
    ticks: true,
    tickColor: '#f9a8d4',
    numeral: 'none',
    numeralColor: '#be185d',
    hour: '#c084fc',
    minute: '#f472b6',
    second: '#fb7185',
    hub: '#fb7185',
    thin: false,
    glow: false,
  },
  羅馬: {
    face: 'var(--sr-surface)',
    ring: 'var(--sr-border)',
    ticks: false,
    tickColor: 'var(--sr-text)',
    numeral: 'roman',
    numeralColor: 'var(--sr-text)',
    hour: 'var(--sr-text)',
    minute: 'var(--sr-text)',
    second: 'var(--sr-accent)',
    hub: 'var(--sr-accent)',
    thin: false,
    glow: false,
  },
}
/* eslint-enable no-restricted-syntax */

const ROMAN =['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', 'Ⅶ', 'Ⅷ', 'Ⅸ', 'Ⅹ', 'Ⅺ', 'Ⅻ']

/** 極座標 → viewBox 卡氏座標。中心 (50,50)、12 點在正上方（angle 0 朝上、順時針）。 */
function polar(angleDeg: number, r: number): { x: number; y: number } {
  const a = ((angleDeg - 90) * Math.PI) / 180
  return { x: 50 + r * Math.cos(a), y: 50 + r * Math.sin(a) }
}

/**
 * SVG 類比（指針）時鐘。100×100 viewBox 的正方形，width:100% 隨卡片等比縮放、maxWidth 封頂。
 *
 * 指針角度：
 *   秒 = 秒×6°（360/60）
 *   分 = 分×6° + 秒×0.1°（秒帶動分針平滑前進）
 *   時 = (時%12)×30° + 分×0.5°（分帶動時針）
 *
 * reduced-motion：時/分針在非 reduced 時給極短 transition 讓每秒微動更順；
 * reduced 時完全不加 transition。秒針一律不加 transition（避免 59→0 回捲），
 * 靠父層每秒 setState 走一格 —— 逐秒更新是狀態驅動、非 CSS 連續動畫，符合規範（不加持續 spin）。
 */
function AnalogClock({ now, skin, reduced }: { now: Date; skin: ClockSkin; reduced: boolean }) {
  const s = SKINS[skin]
  const sec = now.getSeconds()
  const min = now.getMinutes()
  const hr = now.getHours() % 12

  const secondAngle = sec * 6
  const minuteAngle = min * 6 + sec * 0.1
  const hourAngle = hr * 30 + min * 0.5

  const smooth = reduced ? undefined : 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)'
  const handGlow = (color: string) =>
    s.glow ? { filter: `drop-shadow(0 0 1.4px ${color})` } : undefined

  const timeLabel = safeFormat('zh-TW', { hour: '2-digit', minute: '2-digit' }, now) ?? ''

  return (
    <div style={{ width: '100%', maxWidth: 220, margin: '0 auto', aspectRatio: '1 / 1' }}>
      <svg
        viewBox="0 0 100 100"
        width="100%"
        height="100%"
        role="img"
        aria-label={`指針時鐘，現在時間 ${timeLabel}`}
      >
        <circle cx="50" cy="50" r="47" fill={s.face} stroke={s.ring} strokeWidth="2" />

        {/* 12 刻度（3/6/9/12 較粗長） */}
        {s.ticks &&
          Array.from({ length: 12 }, (_, i) => {
            const major = i % 3 === 0
            const outer = polar(i * 30, 45)
            const inner = polar(i * 30, major ? 39 : 42)
            return (
              <line
                key={i}
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke={s.tickColor}
                strokeWidth={major ? 2 : 1}
                strokeLinecap="round"
                style={s.glow ? { filter: `drop-shadow(0 0 1px ${s.tickColor})` } : undefined}
              />
            )
          })}

        {/* 羅馬數字時標 */}
        {s.numeral === 'roman' &&
          ROMAN.map((r, i) => {
            const p = polar((i + 1) * 30, 38)
            return (
              <text
                key={r}
                x={p.x}
                y={p.y}
                fill={s.numeralColor}
                fontSize="8"
                textAnchor="middle"
                dominantBaseline="central"
              >
                {r}
              </text>
            )
          })}

        {/* 時針 */}
        <line
          x1="50"
          y1="56"
          x2="50"
          y2="30"
          stroke={s.hour}
          strokeWidth={s.thin ? 2.4 : 4.2}
          strokeLinecap="round"
          transform={`rotate(${hourAngle} 50 50)`}
          style={{ ...(smooth ? { transition: smooth } : {}), ...handGlow(s.hour) }}
        />
        {/* 分針 */}
        <line
          x1="50"
          y1="58"
          x2="50"
          y2="20"
          stroke={s.minute}
          strokeWidth={s.thin ? 1.6 : 3}
          strokeLinecap="round"
          transform={`rotate(${minuteAngle} 50 50)`}
          style={{ ...(smooth ? { transition: smooth } : {}), ...handGlow(s.minute) }}
        />
        {/* 秒針（不加 transition：逐秒 tick，避免回捲） */}
        <line
          x1="50"
          y1="60"
          x2="50"
          y2="14"
          stroke={s.second}
          strokeWidth={s.thin ? 0.8 : 1.2}
          strokeLinecap="round"
          transform={`rotate(${secondAngle} 50 50)`}
          style={handGlow(s.second)}
        />
        {/* 中心軸點 */}
        <circle cx="50" cy="50" r={s.thin ? 1.6 : 2.4} fill={s.hub} style={handGlow(s.hub)} />
      </svg>
    </div>
  )
}

/** timeStyle → Intl 時間選項。12 時樣式帶 hour12，秒依樣式決定。 */
function timeOptions(style: TimeStyle): Intl.DateTimeFormatOptions {
  const hour12 = style.startsWith('12 時')
  const withSeconds = style.includes('時:分:秒')
  return {
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' } : {}),
    hour12,
  }
}

/** 安全格式化：任一瀏覽器缺該曆別就回 null，讓那一行優雅略過（不崩）。 */
function safeFormat(locale: string, options: Intl.DateTimeFormatOptions, date: Date): string | null {
  try {
    return new Intl.DateTimeFormat(locale, options).format(date)
  } catch {
    return null
  }
}

// 農曆日的傳統寫法（初一…三十）；Intl 的 chinese 曆只給阿拉伯數字，故自己對應。
const LUNAR_DAYS = [
  '',
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
]

/** 農曆「六月十六」：月份用 Intl（含閏月），日改成傳統寫法。缺 chinese 曆回 null。 */
function lunarText(date: Date): string | null {
  try {
    const parts = new Intl.DateTimeFormat('zh-TW-u-ca-chinese', {
      month: 'long',
      day: 'numeric',
    }).formatToParts(date)
    const month = parts.find((p) => p.type === 'month')?.value ?? ''
    const dayRaw = parts.find((p) => p.type === 'day')?.value ?? ''
    const dayNum = Number(dayRaw)
    const day = LUNAR_DAYS[dayNum] ?? dayRaw
    if (!month && !day) return null
    return `農曆${month}${day}`
  } catch {
    return null
  }
}

export default function DateTimeWidget({ config }: WidgetProps) {
  const cfg = (config as Cfg | null) ?? {}
  const showTime = cfg.showTime ?? true
  const clockKind: ClockKind = cfg.clockKind ?? '電子'
  const clockSkin: ClockSkin = cfg.clockSkin ?? '經典'
  const timeStyle: TimeStyle = cfg.timeStyle ?? '24 時（時:分）'
  const showGregorian = cfg.showGregorian ?? true
  const showWeekday = cfg.showWeekday ?? true
  const showRoc = cfg.showRoc ?? false
  const showLunar = cfg.showLunar ?? false

  // null 直到 client 首次 tick —— 避免 SSR/hydration mismatch（見檔頭）。
  const [now, setNow] = useState<Date | null>(null)
  // reduced-motion：SSR 安全，初值 false、掛載後才讀 matchMedia。只用來決定指針是否加平滑 transition。
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduced(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  // 掛載前的占位：server 與 client 首幀一致。
  if (!now) {
    return (
      <div className="sr-card sr-widget" style={{ minWidth: 0 }}>
        <h3 className="sr-widget-title">時間日期</h3>
        <p className="sr-muted" style={{ margin: 0 }}>
          載入中…
        </p>
      </div>
    )
  }

  // ── 時間 ──（裝置本地時區 = 當地時間）
  // 電子鐘面才算數字字串；指針鐘面改畫 SVG。showTime 關掉則兩者都不顯示。
  const showAnalog = showTime && clockKind === '指針'
  const timeText =
    showTime && clockKind === '電子' ? safeFormat('zh-TW', timeOptions(timeStyle), now) : null

  // ── 西元 + 星期 ──
  // 兩者都開 → 合成一行「2026年7月29日 星期三」；只開星期 → 只顯示「星期三」。
  let gregorianLine: string | null = null
  if (showGregorian) {
    gregorianLine = safeFormat(
      'zh-TW',
      {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        ...(showWeekday ? { weekday: 'long' } : {}),
      },
      now,
    )
  } else if (showWeekday) {
    gregorianLine = safeFormat('zh-TW', { weekday: 'long' }, now)
  }

  // ── 民國（roc 曆）──
  // Intl 一般已含「民國」紀元字樣（如「民國115年7月29日」）；保險起見，
  // 若輸出未含「民國」則自行補上前綴。
  let rocLine: string | null = null
  if (showRoc) {
    const raw = safeFormat('zh-TW-u-ca-roc', { year: 'numeric', month: 'long', day: 'numeric' }, now)
    if (raw) rocLine = raw.includes('民國') ? raw : `民國${raw}`
  }

  // ── 農曆（chinese 曆）──「農曆六月十六」（日用傳統寫法）。
  const lunarLine: string | null = showLunar ? lunarText(now) : null

  const dateLines = [gregorianLine, rocLine, lunarLine].filter((x): x is string => x !== null)

  return (
    <div className="sr-card sr-widget" style={{ minWidth: 0 }}>
      <h3 className="sr-widget-title">時間日期</h3>

      {showAnalog && <AnalogClock now={now} skin={clockSkin} reduced={reduced} />}

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

      {!timeText && !showAnalog && dateLines.length === 0 && (
        <p className="sr-muted" style={{ margin: 0 }}>
          都沒有勾選要顯示的項目，到設定勾選時間或日期。
        </p>
      )}
    </div>
  )
}
