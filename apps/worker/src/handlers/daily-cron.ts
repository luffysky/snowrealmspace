import type { Job } from 'pg-boss'
import { createAdminClient } from '@snowrealm/db/server'
import { getTodayContent, maybeGenerateProactive, generateInsights } from '@snowrealm/daily-engine'

/**
 * 每日與每週的時區掃描（ADR-008、08-jobs-events.md §3.1）。
 *
 * 「每天早上」在多時區下不是單一時刻，所以排程每小時跑一次，
 * 只挑出當地時間剛好跨過門檻的 space：
 *   - daily.generate：當地 04:00 → 生成每日卡片 + 主動訊息
 *   - insight.weekly：當地週一 09:00 → 生成週回顧 Insight + weekly_recap 通知
 *
 * 冪等：getTodayContent/generateInsights 都是 upsert；主動訊息有自己的 3/日上限與去重；
 * weekly_recap 通知在建立前先檢查本週期是否已發過。
 */
const DAILY_HOUR = 4
const WEEKLY_HOUR = 9
const WEEKLY_WEEKDAY = 'Mon'

type SpaceRow = { id: string; timezone: string; owner_id: string }

/** 用 Intl 取某時區的當地小時與星期（三字母）。 */
function localParts(timeZone: string, now: Date): { hour: number; weekday: string } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    hour12: false,
    weekday: 'short',
  })
  const parts = fmt.formatToParts(now)
  const hourStr = parts.find((p) => p.type === 'hour')?.value ?? '0'
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? ''
  // '24' → 0（某些環境午夜回 24）
  const hour = Number(hourStr) % 24
  return { hour, weekday }
}

export async function handleDailyGenerate(_jobs: Job<unknown>[]): Promise<void> {
  const admin = createAdminClient()
  const { data: spaces } = await admin.from('spaces').select('id, timezone, owner_id').is('deleted_at', null)
  const now = new Date()
  let generated = 0

  for (const s of (spaces ?? []) as SpaceRow[]) {
    const { hour } = localParts(s.timezone, now)
    if (hour !== DAILY_HOUR) continue
    try {
      await getTodayContent(s.id, s.timezone)
      if (s.owner_id) await maybeGenerateProactive(s.id, s.owner_id, s.timezone)
      generated++
    } catch (e) {
      console.error('[daily.generate] 失敗', s.id, (e as Error).message)
    }
  }
  console.log(`[daily.generate] 掃描 ${(spaces ?? []).length} space，當地 04:00 生成 ${generated} 個`)
}

export async function handleInsightWeekly(_jobs: Job<unknown>[]): Promise<void> {
  const admin = createAdminClient()
  const { data: spaces } = await admin.from('spaces').select('id, timezone, owner_id').is('deleted_at', null)
  const now = new Date()
  let done = 0

  for (const s of (spaces ?? []) as SpaceRow[]) {
    const { hour, weekday } = localParts(s.timezone, now)
    if (hour !== WEEKLY_HOUR || weekday !== WEEKLY_WEEKDAY) continue
    try {
      const insights = await generateInsights(s.id, s.timezone)
      if (insights.length > 0 && s.owner_id) {
        await createWeeklyRecapNotification(admin, s.id, s.owner_id, insights.length)
      }
      done++
    } catch (e) {
      console.error('[insight.weekly] 失敗', s.id, (e as Error).message)
    }
  }
  console.log(`[insight.weekly] 掃描 ${(spaces ?? []).length} space，週一 09:00 處理 ${done} 個`)
}

/** 建立 weekly_recap 通知（本週期只發一次）。 */
async function createWeeklyRecapNotification(
  admin: ReturnType<typeof createAdminClient>,
  spaceId: string,
  userId: string,
  count: number,
): Promise<void> {
  // 過去 24 小時內已有 weekly_recap → 不重發（冪等保底）
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const { count: existing } = await admin
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('space_id', spaceId)
    .eq('category', 'weekly_recap')
    .gte('created_at', dayAgo)
  if ((existing ?? 0) > 0) return

  await admin.from('notifications').insert({
    space_id: spaceId,
    user_id: userId,
    category: 'weekly_recap',
    title: '這週的回顧來了',
    body: `整理了你這週的 ${count} 項活動觀察，點開看看。`,
    link: '/insights',
    channel: 'in_app',
  })
}
