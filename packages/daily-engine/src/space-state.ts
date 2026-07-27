/**
 * 使用者近況推導（Milestone E 前置）。
 *
 * 從 activity_events（ADR-013 唯一事實來源）算出「這個 space 最近怎麼樣」，
 * 交給每日內容選取引擎（pickDailyItem 的 SpaceContext）看人下菜。
 *
 * ## 為什麼是純函式
 *
 * 跟 daily-select 一樣：選錯在真實環境無法清楚回報（「今天這句怪怪的」無法重現），
 * 只能靠測試守。DB 讀取由 service.ts 做，這裡只吃事件陣列算狀態。
 *
 * ## 只用使用者自己已被記錄的事件
 *
 * 不新增任何追蹤、不碰位置或第三方。全部來自使用者在自己 space 內的動作，
 * 跟 insights.ts 同一份資料、同一條 service-role 讀取路徑。
 */

/** 狀態標籤命名空間：`st_` 前綴，避免和內容主題 tag（patience、scent…）撞名。 */
export const STATE_TAGS = {
  /** 久違回歸：離開 ≥ RETURNING_GAP_DAYS 天後又回來 */
  returning: 'st_returning',
  /** 連續造訪：連續 ≥ STREAK_MIN_DAYS 天出沒 */
  streak: 'st_streak',
  /** 創作中：近 RECENT_WINDOW_DAYS 天有上傳/建立專案 */
  creating: 'st_creating',
  /** 佈置中：近 RECENT_WINDOW_DAYS 天有動主題/背景 */
  decorating: 'st_decorating',
  /** 夜貓：窗口內多次在深夜開啟 */
  nightOwl: 'st_nightowl',
} as const

export type StateTag = (typeof STATE_TAGS)[keyof typeof STATE_TAGS]

// 判定門檻（演算法參數，非假值——每一個都有明確語意）
const RETURNING_GAP_DAYS = 7 // 上一次活動距今 ≥ 這麼多天，且今天回來 → 回歸
const STREAK_MIN_DAYS = 3 // 連續活躍天數達標 → 連續造訪
const RECENT_WINDOW_DAYS = 3 // 「最近」的定義：近 N 天
const NIGHT_OWL_MIN = 3 // 窗口內深夜開啟達這麼多次 → 夜貓
const NIGHT_START_HOUR = 0
const NIGHT_END_HOUR = 5 // [0,5) 視為深夜
const ACTIVE_HIGH = 5 // 近 7 天出沒 ≥ 5 天 → high
const ACTIVE_LOW = 1 // 近 7 天出沒 ≤ 1 天 → low

export type StateEvent = { event_type: string; occurred_at: string }

export type DerivedState = {
  recentActivityLevel: 'high' | 'normal' | 'low'
  tags: StateTag[]
  /** 給人看的一行摘要——狀態不能靜默，要能被觀察（CLAUDE.md：靜默失敗是 bug）。 */
  summary: string
}

function localDate(timeZone: string, at: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at)
}

function localHour(timeZone: string, at: Date): number {
  const s = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    hour12: false,
  }).format(at)
  return Number(s.slice(0, 2))
}

/** a、b 皆為 YYYY-MM-DD，回傳 a 早於 b 幾天（可為負）。 */
function dayDiff(a: string, b: string): number {
  const da = Date.parse(`${a}T00:00:00Z`)
  const db = Date.parse(`${b}T00:00:00Z`)
  return Math.round((db - da) / 86400000)
}

/**
 * 從近 30 天的事件算出狀態。events 順序不拘。
 * `now` 可注入以利測試；預設用當下。
 */
export function deriveSpaceState(
  events: readonly StateEvent[],
  timeZone: string,
  now: Date,
): DerivedState {
  const today = localDate(timeZone, now)

  // 每天的當地日期集合（去重、排序）
  const dayset = new Set<string>()
  for (const e of events) {
    const t = Date.parse(e.occurred_at)
    if (Number.isNaN(t)) continue
    dayset.add(localDate(timeZone, new Date(t)))
  }
  const days = [...dayset].sort() // 舊 → 新

  // 近 7 天出沒天數 → 活躍度
  const activeLast7 = days.filter((d) => {
    const diff = dayDiff(d, today)
    return diff >= 0 && diff < 7
  }).length
  const recentActivityLevel: DerivedState['recentActivityLevel'] =
    activeLast7 >= ACTIVE_HIGH ? 'high' : activeLast7 <= ACTIVE_LOW ? 'low' : 'normal'

  const tags: StateTag[] = []

  // 回歸：今天有活動，且上一個活動日距今 ≥ 門檻
  const priorDays = days.filter((d) => dayDiff(d, today) > 0) // 嚴格早於今天
  const hasToday = dayset.has(today)
  if (hasToday && priorDays.length > 0) {
    const lastPrior = priorDays[priorDays.length - 1]!
    if (dayDiff(lastPrior, today) >= RETURNING_GAP_DAYS) tags.push(STATE_TAGS.returning)
  }

  // 連續造訪：從今天（或昨天，容一天時差）往回數連續天數
  const streak = countStreak(dayset, today)
  if (streak >= STREAK_MIN_DAYS) tags.push(STATE_TAGS.streak)

  // 近 N 天的事件型別
  const recentTypes = new Set<string>()
  const nightOpens: number[] = []
  for (const e of events) {
    const t = Date.parse(e.occurred_at)
    if (Number.isNaN(t)) continue
    const d = localDate(timeZone, new Date(t))
    if (dayDiff(d, today) >= 0 && dayDiff(d, today) < RECENT_WINDOW_DAYS) recentTypes.add(e.event_type)
    if (e.event_type === 'space.opened') {
      const h = localHour(timeZone, new Date(t))
      if (h >= NIGHT_START_HOUR && h < NIGHT_END_HOUR) nightOpens.push(h)
    }
  }
  const hasAny = (pred: (t: string) => boolean) => [...recentTypes].some(pred)
  if (hasAny((t) => t === 'asset.uploaded' || t === 'project.created')) tags.push(STATE_TAGS.creating)
  if (hasAny((t) => t.startsWith('theme.') || t.startsWith('background.'))) tags.push(STATE_TAGS.decorating)
  if (nightOpens.length >= NIGHT_OWL_MIN) tags.push(STATE_TAGS.nightOwl)

  return {
    recentActivityLevel,
    tags,
    summary: buildSummary(recentActivityLevel, tags, activeLast7),
  }
}

/** 從 anchor 當地日往回數連續出沒天數。容許 anchor 當天沒活動時從昨天起算。 */
function countStreak(dayset: Set<string>, anchor: string): number {
  let cursor = anchor
  // 今天還沒活動也不算斷——從昨天起算
  if (!dayset.has(cursor)) cursor = shiftDay(cursor, -1)
  let n = 0
  while (dayset.has(cursor)) {
    n++
    cursor = shiftDay(cursor, -1)
  }
  return n
}

function shiftDay(date: string, delta: number): string {
  const t = Date.parse(`${date}T00:00:00Z`) + delta * 86400000
  return new Date(t).toISOString().slice(0, 10)
}

const TAG_LABEL: Record<StateTag, string> = {
  st_returning: '回歸',
  st_streak: '連續造訪',
  st_creating: '創作中',
  st_decorating: '佈置中',
  st_nightowl: '夜貓',
}

function buildSummary(
  level: DerivedState['recentActivityLevel'],
  tags: StateTag[],
  activeLast7: number,
): string {
  const parts = [`活躍度 ${level}（近 7 天 ${activeLast7} 天）`]
  if (tags.length > 0) parts.push(tags.map((t) => TAG_LABEL[t]).join('、'))
  return parts.join('・')
}
