import { createAdminClient } from '@snowrealm/db/server'
import { hashToUnit } from '@snowrealm/validation'

/**
 * 驚喜盒。09-content-pool.md。
 *
 * 每天一個可開的盒子。開盒時依稀有度機率抽一則**沒開過**的內容，
 * 寫入 surprises 表（unlocked_at=now）。同一天重複進來看到同一個結果。
 *
 * 走 service role：surprises 的寫入是系統行為（抽取與機率保證由伺服器決定，
 * 不能讓客戶端自己選稀有度）。
 */

export type Rarity = 'common' | 'uncommon' | 'rare' | 'special' | 'anniversary'

export type SurpriseView =
  | { state: 'available' } // 今天還沒開
  | {
      state: 'opened'
      rarity: Rarity
      label: string
      text: string
      openedAt: string
    }
  | { state: 'empty' } // 池空了（沒 seed）

/** 每日盒子的稀有度機率。special / anniversary 是條件觸發，不進每日隨機。 */
export const DAILY_WEIGHTS: Record<string, number> = {
  common: 64,
  uncommon: 26,
  rare: 10,
}

/**
 * 稀有度保底：連續開了這麼多盒都沒出 rare（或更稀有），下一盒強制 rare。
 * 期望值上 rare 約每 10 盒一次，保底把「衰到爆」的長尾砍掉，且對玩家公開。
 */
export const PITY_THRESHOLD = 15

const RARITY_LABEL: Record<Rarity, string> = {
  common: '平凡',
  uncommon: '少見',
  rare: '稀有',
  special: '特別',
  anniversary: '週年',
}

export function rarityLabel(r: string): string {
  return RARITY_LABEL[r as Rarity] ?? r
}

function localDate(timeZone: string, now = new Date()): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return fmt.format(now) // YYYY-MM-DD
}

/** 今天的驚喜狀態（已開就回內容，沒開就 available）。 */
export async function getSurpriseState(spaceId: string, timeZone: string): Promise<SurpriseView> {
  const admin = createAdminClient()
  const today = localDate(timeZone)

  // 抓最新一筆已開的，在 JS 用「當地日期」比對是否為今天 ——
  // 直接在 SQL 拿 timestamptz(UTC) 跟當地日期字串比會有時區偏移。
  const { data } = await admin
    .from('surprises')
    .select('rarity, title, body, unlocked_at, created_at')
    .eq('space_id', spaceId)
    .not('unlocked_at', 'is', null)
    .order('unlocked_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (data?.unlocked_at && localDate(timeZone, new Date(data.unlocked_at)) === today) {
    return {
      state: 'opened',
      rarity: data.rarity as Rarity,
      label: data.title,
      text: data.body ?? '',
      openedAt: data.unlocked_at,
    }
  }
  return { state: 'available' }
}

/**
 * 開盒。抽稀有度 → 抽該稀有度未開過的一則 → 寫入。
 *
 * 決定性種子（space+date）：同一天多次點「開」不會刷出不同結果。
 */
export async function openSurprise(spaceId: string, timeZone: string): Promise<SurpriseView> {
  const admin = createAdminClient()
  const today = localDate(timeZone)

  // 今天已經開過 → 直接回既有的（冪等）
  const existing = await getSurpriseState(spaceId, timeZone)
  if (existing.state === 'opened') return existing

  // 已開過的：source_ref 用來避免重複、rarity 用來算保底
  const { data: opened } = await admin
    .from('surprises')
    .select('source_ref, rarity, unlocked_at')
    .eq('space_id', spaceId)
    .not('unlocked_at', 'is', null)
    .order('unlocked_at', { ascending: false })
  const usedIds = new Set(
    (opened ?? []).map((r) => r.source_ref).filter((x): x is string => Boolean(x)),
  )

  const seed = hashToUnit(`${spaceId}:surprise:${today}`)
  let rarity = pickRarity(seed)

  // 保底：距離上一次 rare（或更稀有）已經連續多少盒沒出？
  const RARE_OR_BETTER: Rarity[] = ['rare', 'special', 'anniversary']
  let sinceRare = 0
  for (const row of opened ?? []) {
    if (RARE_OR_BETTER.includes(row.rarity as Rarity)) break
    sinceRare++
  }
  if (sinceRare >= PITY_THRESHOLD) rarity = 'rare' // 觸發保底

  // 抽該稀有度、未開過、啟用中的一則
  const picked = await pickUnopened(admin, rarity, usedIds, seed)
  if (!picked) return { state: 'empty' }

  const { error } = await admin.from('surprises').insert({
    space_id: spaceId,
    kind: 'daily_box',
    rarity: picked.rarity,
    title: picked.label,
    body: picked.text,
    source_ref: picked.contentId,
    unlocked_at: new Date().toISOString(),
  } as never)

  if (error) {
    console.error('[surprise] 寫入失敗', error.message)
    // 併發下可能撞上，回讀既有
    const again = await getSurpriseState(spaceId, timeZone)
    return again.state === 'opened' ? again : { state: 'empty' }
  }

  return {
    state: 'opened',
    rarity: picked.rarity,
    label: picked.label,
    text: picked.text,
    openedAt: new Date().toISOString(),
  }
}

export type ArchivedSurprise = {
  id: string
  rarity: Rarity
  label: string
  text: string
  openedAt: string
  favorited: boolean
}

/** 收藏頁：所有開過的驚喜，最新在前。 */
export async function listOpenedSurprises(spaceId: string): Promise<ArchivedSurprise[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('surprises')
    .select('id, rarity, title, body, unlocked_at, favorited')
    .eq('space_id', spaceId)
    .not('unlocked_at', 'is', null)
    .order('unlocked_at', { ascending: false })

  return (data ?? []).map((r) => ({
    id: r.id,
    rarity: r.rarity as Rarity,
    label: r.title,
    text: r.body ?? '',
    openedAt: r.unlocked_at as string,
    favorited: Boolean(r.favorited),
  }))
}

/** 收藏 / 取消收藏一則驚喜（限本 space）。 */
export async function setSurpriseFavorite(
  spaceId: string,
  id: string,
  favorited: boolean,
): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('surprises')
    .update({ favorited } as never)
    .eq('space_id', spaceId)
    .eq('id', id)
  if (error) throw new Error(`更新收藏失敗：${error.message}`)
}

/** 目前距離上次 rare（含更稀有）連續幾盒沒出 —— 給機率公開頁顯示保底進度。 */
export async function rareDrought(spaceId: string): Promise<number> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('surprises')
    .select('rarity, unlocked_at')
    .eq('space_id', spaceId)
    .not('unlocked_at', 'is', null)
    .order('unlocked_at', { ascending: false })

  const rareOrBetter: Rarity[] = ['rare', 'special', 'anniversary']
  let n = 0
  for (const row of data ?? []) {
    if (rareOrBetter.includes(row.rarity as Rarity)) break
    n++
  }
  return n
}

function pickRarity(seed: number): Rarity {
  const total = Object.values(DAILY_WEIGHTS).reduce((a, b) => a + b, 0)
  let r = seed * total
  for (const [rarity, weight] of Object.entries(DAILY_WEIGHTS)) {
    r -= weight
    if (r < 0) return rarity as Rarity
  }
  return 'common'
}

type Picked = { contentId: string; rarity: Rarity; label: string; text: string }

async function pickUnopened(
  admin: ReturnType<typeof createAdminClient>,
  rarity: Rarity,
  usedIds: Set<string>,
  seed: number,
): Promise<Picked | null> {
  // 先抽指定稀有度；沒有就退回其他稀有度（總比沒有好）
  for (const r of [rarity, 'uncommon', 'common', 'rare'] as Rarity[]) {
    const { data } = await admin
      .from('content_items')
      .select('content_id, label, text, rarity')
      .eq('kind', 'surprise')
      .eq('rarity', r)
      .eq('enabled', true)
    const pool = (data ?? []).filter((row) => !usedIds.has(row.content_id))
    if (pool.length === 0) continue
    const idx = Math.floor(seed * pool.length) % pool.length
    const row = pool[idx]!
    return {
      contentId: row.content_id,
      rarity: (row.rarity as Rarity) ?? r,
      label: row.label ?? '一個驚喜',
      text: row.text,
    }
  }
  return null
}
