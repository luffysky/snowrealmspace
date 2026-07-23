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
const DAILY_WEIGHTS: Record<string, number> = {
  common: 64,
  uncommon: 26,
  rare: 10,
}

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

  // 已開過的 content_id（避免重複）
  const { data: opened } = await admin
    .from('surprises')
    .select('source_ref')
    .eq('space_id', spaceId)
  const usedIds = new Set(
    (opened ?? []).map((r) => r.source_ref).filter((x): x is string => Boolean(x)),
  )

  const seed = hashToUnit(`${spaceId}:surprise:${today}`)
  const rarity = pickRarity(seed)

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
