import { createAdminClient } from '@snowrealm/db/server'
import { createHash } from 'node:crypto'
import {
  pickDailyItem,
  greetingSlotForHour,
  hashToUnit,
  type PoolEntry,
  type RecentItem,
  type SpaceContext,
} from '@snowrealm/validation'
import { solarTermFor } from './seasonal.js'
import { milestoneFor } from './milestone.js'
import { deriveSpaceState, type StateEvent } from './space-state.js'

/**
 * 每日內容的生成與讀取。實作 09-content-pool.md。
 *
 * ## 為什麼在伺服器端、走 service role
 *
 * daily_items 的寫入不開給一般成員（RLS 只給 select/update）——
 * 生成是系統行為，由開啟空間時觸發或 cron 觸發。用 service role 寫入。
 *
 * ## 為什麼是「開啟時生成」而非純 cron
 *
 * cron 掃全部 space 每天生成（08-jobs-events.md）是完整方案，但
 * 「開啟時若當天還沒有就生成」讓使用者第一次進來就有內容，
 * 不必等 cron 那一輪。兩者靠 unique(space_id, local_date, kind) 冪等共存。
 */

const KIND_MAP = {
  quote: 'daily_card',
  prompt: 'creative_prompt',
  question: 'daily_question',
  micro_action: 'micro_action',
} as const
const COOLDOWN = { quote: 30, prompt: 60, question: 45, micro_action: 45 } as const

export type TodayContent = {
  greeting: string | null
  quote: { id: string; text: string } | null
  prompt: { id: string; text: string; estimatedMinutes: number | null } | null
  /** 每日一問：反思提問 */
  question: { id: string; text: string } | null
  /** 微行動：2 分鐘小任務 */
  microAction: { id: string; text: string; estimatedMinutes: number | null } | null
  /** 季節·節氣語：依當天節氣挑 */
  seasonal: { term: string; text: string } | null
  /** 里程碑回顧：剛好到註冊天數節點那天才有 */
  milestone: { label: string; text: string } | null
}

/** space 當地日期（YYYY-MM-DD）與小時。 */
function localNow(timeZone: string, now = new Date()): { date: string; hour: number } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  })
  const parts = fmt.formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) }
}

function contentHash(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 32)
}

/**
 * 確保今天的 daily_card / creative_prompt 已生成，然後回傳今天的內容。
 *
 * 讀取用受 RLS 約束的 client（呼叫端傳入），生成用 service role。
 * greeting 是即時挑（依當前小時），不存 daily_items —— 它跟「日期」無關，
 * 跟「現在幾點」有關，存起來反而會在跨時段時顯示錯的問候。
 */
export async function getTodayContent(spaceId: string, timeZone: string): Promise<TodayContent> {
  const admin = createAdminClient()
  const { date, hour } = localNow(timeZone)

  // space 的 signup 天數與 tag（脈絡）
  const { data: space } = await admin
    .from('spaces')
    .select('created_at, privacy')
    .eq('id', spaceId)
    .maybeSingle()
  const daysSinceSignup = space?.created_at
    ? Math.max(0, Math.floor((Date.now() - Date.parse(space.created_at)) / 86400000))
    : 0

  // 近況：從使用者自己的 activity_events 推導（非寫死）。
  // 近 30 天足以判斷回歸/連續/創作中/佈置中；讀取走 service role（同 insights）。
  const stateSince = new Date(Date.now() - 30 * 86400000).toISOString()
  const { data: stateEvents } = await admin
    .from('activity_events')
    .select('event_type, occurred_at')
    .eq('space_id', spaceId)
    .gte('occurred_at', stateSince)
    .order('occurred_at', { ascending: false })

  const state = deriveSpaceState((stateEvents ?? []) as StateEvent[], timeZone, new Date())

  const context: SpaceContext = {
    daysSinceSignup,
    tags: state.tags,
    recentActivityLevel: state.recentActivityLevel,
  }

  // 已生成的今日內容
  const { data: existing } = await admin
    .from('daily_items')
    .select('kind, title, body, source_ref, payload')
    .eq('space_id', spaceId)
    .eq('local_date', date)
    .in('kind', ['daily_card', 'creative_prompt', 'daily_question', 'micro_action'])

  const have = new Map<string, GenRow>(
    (existing ?? []).map((r) => [r.kind, r as GenRow]),
  )

  // 缺哪個就生成哪個
  for (const kind of ['quote', 'prompt', 'question', 'micro_action'] as const) {
    if (have.has(KIND_MAP[kind])) continue
    const generated = await generateOne(admin, spaceId, date, kind, context)
    if (generated) have.set(KIND_MAP[kind], generated)
  }

  const quoteRow = have.get('daily_card')
  const promptRow = have.get('creative_prompt')
  const questionRow = have.get('daily_question')
  const actionRow = have.get('micro_action')
  const minutesOf = (row: GenRow | undefined): number | null =>
    (row?.payload as { estimatedMinutes?: number } | null)?.estimatedMinutes ?? null

  return {
    greeting: await pickGreeting(admin, spaceId, hour),
    quote: quoteRow ? { id: quoteRow.source_ref ?? '', text: quoteRow.body } : null,
    prompt: promptRow
      ? { id: promptRow.source_ref ?? '', text: promptRow.body, estimatedMinutes: minutesOf(promptRow) }
      : null,
    question: questionRow ? { id: questionRow.source_ref ?? '', text: questionRow.body } : null,
    microAction: actionRow
      ? { id: actionRow.source_ref ?? '', text: actionRow.body, estimatedMinutes: minutesOf(actionRow) }
      : null,
    seasonal: await pickSeasonal(admin, spaceId, date),
    milestone: await pickMilestone(admin, spaceId, daysSinceSignup),
  }
}

/**
 * 里程碑回顧。只有「剛好到某個註冊天數節點」的當天才回傳一則。
 * 先找 tags 含里程碑 key 的，沒有退 generic。
 */
async function pickMilestone(
  admin: ReturnType<typeof createAdminClient>,
  spaceId: string,
  daysSinceSignup: number,
): Promise<{ label: string; text: string } | null> {
  const m = milestoneFor(daysSinceSignup)
  if (!m) return null

  const { data } = await admin
    .from('content_items')
    .select('text, tags')
    .eq('kind', 'milestone')
    .eq('enabled', true)
  if (!data || data.length === 0) return null

  const byKey = data.filter((r) => (r.tags ?? []).includes(m.key))
  const generic = data.filter((r) => (r.tags ?? []).includes('generic'))
  const pool = byKey.length > 0 ? byKey : generic.length > 0 ? generic : data

  const idx = Math.floor(hashToUnit(`${spaceId}:milestone:${daysSinceSignup}`) * pool.length)
  const picked = pool[idx] ?? pool[0]!
  return { label: m.label, text: picked.text }
}

/**
 * 季節·節氣語。依當天落在哪個節氣挑一則（不存 DB，跟日期決定性掛勾）。
 * 先找 tags 含節氣 slug 的，沒有退季節 slug，再沒有用整池。
 */
async function pickSeasonal(
  admin: ReturnType<typeof createAdminClient>,
  spaceId: string,
  date: string,
): Promise<{ term: string; text: string } | null> {
  const [, m, d] = date.split('-').map(Number)
  const term = solarTermFor(m ?? 1, d ?? 1)

  const { data } = await admin
    .from('content_items')
    .select('text, tags')
    .eq('kind', 'seasonal')
    .eq('enabled', true)
  if (!data || data.length === 0) return null

  const bySlug = data.filter((r) => (r.tags ?? []).includes(term.slug))
  const bySeason = data.filter((r) => (r.tags ?? []).includes(term.season))
  const pool = bySlug.length > 0 ? bySlug : bySeason.length > 0 ? bySeason : data

  const idx = Math.floor(hashToUnit(`${spaceId}:seasonal:${date}`) * pool.length)
  const picked = pool[idx] ?? pool[0]!
  return { term: term.name, text: picked.text }
}

type GenRow = { kind: string; title: string | null; body: string; source_ref: string | null; payload: unknown }

async function generateOne(
  admin: ReturnType<typeof createAdminClient>,
  spaceId: string,
  date: string,
  kind: 'quote' | 'prompt' | 'question' | 'micro_action',
  context: SpaceContext,
): Promise<GenRow | null> {
  // 池：該類啟用中的全部
  const { data: poolRows } = await admin
    .from('content_items')
    .select('content_id, text, tags, weight, estimated_minutes, min_days_since_signup, requires_tag, cooldown_days')
    .eq('kind', kind)
    .eq('enabled', true)

  if (!poolRows || poolRows.length === 0) return null

  const pool: PoolEntry[] = poolRows.map((r) => ({
    contentId: r.content_id,
    text: r.text,
    tags: r.tags ?? [],
    weight: Number(r.weight ?? 1),
    estimatedMinutes: r.estimated_minutes,
    minDaysSinceSignup: r.min_days_since_signup,
    requiresTag: r.requires_tag,
    cooldownDays: r.cooldown_days,
  }))

  // 冷卻歷史：這個 space 這一類最近 90 天的 daily_items
  const since = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)
  const { data: recentRows } = await admin
    .from('daily_items')
    .select('source_ref, local_date, payload')
    .eq('space_id', spaceId)
    .eq('kind', KIND_MAP[kind])
    .gte('local_date', since)

  const recent: RecentItem[] = (recentRows ?? []).map((r) => ({
    contentId: r.source_ref ?? '',
    localDate: r.local_date,
    tags: (r.payload as { tags?: string[] } | null)?.tags ?? [],
  }))

  const picked = pickDailyItem({
    pool,
    localDate: date,
    recent,
    context,
    defaultCooldownDays: COOLDOWN[kind],
    seed: `${spaceId}:${date}:${kind}`,
  })
  if (!picked) return null

  const row = {
    space_id: spaceId,
    local_date: date,
    kind: KIND_MAP[kind],
    title: null,
    body: picked.text,
    payload: { tags: picked.tags, estimatedMinutes: picked.estimatedMinutes ?? null } as never,
    source: 'pool' as const,
    source_ref: picked.contentId,
    content_hash: contentHash(picked.text),
    status: 'delivered' as const,
    delivered_at: new Date().toISOString(),
  }

  // 冪等插入：併發或 cron 撞上時，unique 衝突視為已生成，忽略
  const { data, error } = await admin
    .from('daily_items')
    .upsert(row as never, { onConflict: 'space_id,local_date,kind', ignoreDuplicates: true })
    .select('kind, title, body, source_ref, payload')
    .maybeSingle()

  if (error) {
    console.error('[daily] 生成失敗', kind, error.message)
    return null
  }
  // ignoreDuplicates 命中時 data 為 null → 回讀既有的
  if (!data) {
    const { data: existing } = await admin
      .from('daily_items')
      .select('kind, title, body, source_ref, payload')
      .eq('space_id', spaceId)
      .eq('local_date', date)
      .eq('kind', KIND_MAP[kind])
      .maybeSingle()
    return existing ?? null
  }
  return data
}

/**
 * 即時挑一則問候。依當前時段，不存 DB。
 *
 * night 時段的內容已在 check:content 保證不含催促字樣。
 */
async function pickGreeting(
  admin: ReturnType<typeof createAdminClient>,
  spaceId: string,
  hour: number,
): Promise<string | null> {
  const slot = greetingSlotForHour(hour)
  const { data } = await admin
    .from('content_items')
    .select('content_id, text, weight')
    .eq('kind', 'greeting')
    .eq('greeting_slot', slot)
    .eq('enabled', true)
    .eq('requires_background_changed', false)

  if (!data || data.length === 0) return null

  // 問候不需跨日一致，用 space+小時 當種子即可（同一小時內穩定）
  const { hashToUnit } = await import('@snowrealm/validation')
  const idx = Math.floor(hashToUnit(`${spaceId}:greet:${hour}`) * data.length)
  return data[idx]?.text ?? data[0]!.text
}
