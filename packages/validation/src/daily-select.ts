/**
 * 每日內容選取演算法。實作 09-content-pool.md §5。
 *
 * 純函式，不碰 DB —— DB 讀取由呼叫端做好，這裡只做「給定池與歷史，選一則」。
 * 抽成純函式的理由跟背景輪播一樣：選錯在真實環境幾乎無法被清楚回報
 * （「今天的句子好像上週看過」無法重現），只能靠測試守。
 */

export type PoolEntry = {
  contentId: string
  text: string
  tags: string[]
  weight: number
  estimatedMinutes?: number | null
  minDaysSinceSignup?: number | null
  requiresTag?: string | null
  cooldownDays?: number | null
}

export type RecentItem = {
  contentId: string
  localDate: string // YYYY-MM-DD
  tags: string[]
}

export type SpaceContext = {
  daysSinceSignup: number
  tags: string[]
  recentActivityLevel: 'high' | 'normal' | 'low'
}

export type SelectInput = {
  pool: readonly PoolEntry[]
  localDate: string
  recent: readonly RecentItem[]
  context: SpaceContext
  /** 預設冷卻天數（quote 30、prompt 60）。entry.cooldownDays 可覆寫。 */
  defaultCooldownDays: number
  /** 決定性隨機：同一組輸入永遠選同一則（同一天不會因重整而變）。 */
  seed: string
}

/**
 * 選一則。回傳 null 代表池空或全部被濾掉（呼叫端據此決定降級）。
 *
 * 步驟（09 §5）：
 *   1. 濾冷卻中的
 *   2. 濾不符條件（minDaysSinceSignup、requiresTag）
 *   3. 濾與前兩天 tag 重疊的（同類型不連續三天）
 *   4. 依活躍度調權重
 *   5. 加權隨機（決定性）
 *   6-8. 候選為空 → 逐步放寬
 */
export function pickDailyItem(input: SelectInput): PoolEntry | null {
  const { pool, recent, context } = input

  // 條件過濾（第 2 步）—— 這一條不放寬，是硬性資格
  const eligible = pool.filter((e) => {
    if (e.minDaysSinceSignup != null && context.daysSinceSignup < e.minDaysSinceSignup) return false
    if (e.requiresTag && !context.tags.includes(e.requiresTag)) return false
    return true
  })
  if (eligible.length === 0) return null

  const cooldownOf = (e: PoolEntry) => e.cooldownDays ?? input.defaultCooldownDays

  // 最近用過的 id → 最近日期，判斷是否還在冷卻
  const lastSeen = new Map<string, string>()
  for (const r of recent) {
    const prev = lastSeen.get(r.contentId)
    if (!prev || r.localDate > prev) lastSeen.set(r.contentId, r.localDate)
  }

  // 前兩天用過的 tag（第 3 步：同類型不連續三天）
  const recentTags = new Set(
    recent
      .filter((r) => daysBetween(r.localDate, input.localDate) <= 2)
      .flatMap((r) => r.tags),
  )

  const notInCooldown = (e: PoolEntry) => {
    const seen = lastSeen.get(e.contentId)
    if (!seen) return true
    return daysBetween(seen, input.localDate) >= cooldownOf(e)
  }
  const noTagClash = (e: PoolEntry) => !e.tags.some((t) => recentTags.has(t))

  // 第 5→8 步：逐步放寬直到有候選
  const attempts: PoolEntry[][] = [
    eligible.filter((e) => notInCooldown(e) && noTagClash(e)), // 全條件
    eligible.filter(notInCooldown), // 放寬 tag 衝突
    eligible.filter((e) => {
      // 放寬冷卻至一半
      const seen = lastSeen.get(e.contentId)
      if (!seen) return true
      return daysBetween(seen, input.localDate) >= cooldownOf(e) / 2
    }),
    eligible, // 全部放寬（總比沒有好）
  ]

  const candidates = attempts.find((a) => a.length > 0)
  if (!candidates || candidates.length === 0) return null

  // 第 4 步：活躍度調權重 —— 低活躍時偏好低門檻（estimatedMinutes ≤ 5）
  const weighted = candidates.map((e) => {
    let w = e.weight
    if (context.recentActivityLevel === 'low' && (e.estimatedMinutes ?? 99) <= 5) w *= 3
    return { entry: e, weight: w }
  })

  return weightedPick(weighted, input.seed)
}

/** 決定性加權抽取。同 seed 永遠回同一則。 */
function weightedPick(items: { entry: PoolEntry; weight: number }[], seed: string): PoolEntry {
  const total = items.reduce((s, i) => s + i.weight, 0)
  // seed → [0,1) 的決定性亂數
  const r = hashToUnit(seed) * total
  let acc = 0
  for (const item of items) {
    acc += item.weight
    if (r < acc) return item.entry
  }
  return items[items.length - 1]!.entry
}

/** FNV-1a 雜湊 → [0,1)。決定性、跨環境一致。 */
export function hashToUnit(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  // 轉成無號再壓到 [0,1)
  return (h >>> 0) / 4294967296
}

/** 兩個 YYYY-MM-DD 相差幾天（絕對值）。 */
export function daysBetween(a: string, b: string): number {
  const da = Date.parse(`${a}T00:00:00Z`)
  const db = Date.parse(`${b}T00:00:00Z`)
  if (Number.isNaN(da) || Number.isNaN(db)) return Infinity
  return Math.abs(Math.round((db - da) / 86400000))
}

/** 依當前小時決定問候時段。 */
export function greetingSlotForHour(hour: number): 'morning' | 'afternoon' | 'evening' | 'night' {
  if (hour >= 5 && hour < 11) return 'morning'
  if (hour >= 11 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 21) return 'evening'
  return 'night'
}
