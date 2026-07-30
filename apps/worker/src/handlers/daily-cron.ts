import type { Job } from 'pg-boss'
import { createAdminClient } from '@snowrealm/db/server'
import { getTodayContent, maybeGenerateProactive, generateInsights } from '@snowrealm/daily-engine'
import { sendEmail, weeklyRecapHtml } from '../email.js'

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
const BIRTHDAY_HOUR = 9
const WEEKLY_WEEKDAY = 'Mon'

type SpaceRow = { id: string; timezone: string; owner_id: string }

/**
 * 讀取某個 feature flag 的閘門狀態：全域預設 + per-space 覆寫。
 * worker 沒有 web 的 flags 快取層，直接用 admin client 查（flag 是系統設定，非使用者資料）。
 */
async function loadFlagGate(
  admin: ReturnType<typeof createAdminClient>,
  key: string,
): Promise<{ global: boolean; overrides: Map<string, boolean> }> {
  const { data: globalRow } = await admin
    .from('feature_flags')
    .select('enabled')
    .eq('key', key)
    .maybeSingle()
  const { data: overrideRows } = await admin
    .from('space_feature_overrides')
    .select('space_id, enabled')
    .eq('key', key)
  const overrides = new Map<string, boolean>()
  for (const r of overrideRows ?? []) overrides.set(r.space_id, r.enabled)
  return { global: globalRow?.enabled ?? false, overrides }
}
type SpaceWithBirthday = SpaceRow & {
  space_settings: {
    birthday_month: number | null
    birthday_day: number | null
    birthday_greeted_year: number | null
  } | null
}

/** 用 Intl 取某時區的當地小時、星期（三字母）、年月日。 */
function localParts(
  timeZone: string,
  now: Date,
): { hour: number; weekday: string; year: number; month: number; day: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    hour12: false,
    weekday: 'short',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  })
  const parts = fmt.formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  const hour = Number(get('hour') || '0') % 24
  return {
    hour,
    weekday: get('weekday'),
    year: Number(get('year') || '0'),
    month: Number(get('month') || '0'),
    day: Number(get('day') || '0'),
  }
}

export async function handleDailyGenerate(_jobs: Job<unknown>[]): Promise<void> {
  const admin = createAdminClient()
  const { data: spaces } = await admin
    .from('spaces')
    .select(
      'id, timezone, owner_id, space_settings(birthday_month, birthday_day, birthday_greeted_year)',
    )
    .is('deleted_at', null)
  const now = new Date()
  let generated = 0

  for (const s of (spaces ?? []) as SpaceWithBirthday[]) {
    const { hour, month, day, year } = localParts(s.timezone, now)

    if (hour === DAILY_HOUR) {
      try {
        await getTodayContent(s.id, s.timezone)
        if (s.owner_id) await maybeGenerateProactive(s.id, s.owner_id, s.timezone)
        generated++
      } catch (e) {
        console.error('[daily.generate] 失敗', s.id, (e as Error).message)
      }
    }

    // 生日祝福：有填生日、當地 09:00、今天是生日、今年還沒祝過 → 寄一則祝福通知
    const bd = s.space_settings
    if (
      hour === BIRTHDAY_HOUR &&
      bd?.birthday_month === month &&
      bd?.birthday_day === day &&
      bd?.birthday_greeted_year !== year
    ) {
      try {
        await admin.from('notifications').insert({
          space_id: s.id,
          category: 'birthday',
          title: '生日快樂！🎂',
          body: '今天是你的日子。願這一年，你在這個小小空間裡，也過得溫暖、被好好接住。🤍',
        } as never)
        await admin
          .from('space_settings')
          .update({ birthday_greeted_year: year })
          .eq('space_id', s.id)
        console.log('[daily.generate] 生日祝福已送', s.id)
      } catch (e) {
        console.error('[daily.generate] 生日祝福失敗', s.id, (e as Error).message)
      }
    }
  }
  console.log(`[daily.generate] 掃描 ${(spaces ?? []).length} space，當地 04:00 生成 ${generated} 個`)
}

export async function handleInsightWeekly(_jobs: Job<unknown>[]): Promise<void> {
  const admin = createAdminClient()
  const { data: spaces } = await admin.from('spaces').select('id, timezone, owner_id').is('deleted_at', null)
  const now = new Date()
  let done = 0

  // weeklyRecap flag gate（ADR-018）：全域預設 + per-space 覆寫。關閉就整個略過，
  // 不再對所有 space 無條件跑 —— 這樣後台切這個 flag 才真的有作用。
  const weekly = await loadFlagGate(admin, 'weeklyRecap')

  for (const s of (spaces ?? []) as SpaceRow[]) {
    if (!(weekly.overrides.get(s.id) ?? weekly.global)) continue
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

  // 週報 email（opt-in：weekly_recap_email 為真才寄；沒設 RESEND 金鑰時 sendEmail 會誠實跳過）
  const { data: settings } = await admin
    .from('space_settings')
    .select('weekly_recap_email')
    .eq('space_id', spaceId)
    .maybeSingle()
  if (settings?.weekly_recap_email) {
    const { data: userRes } = await admin.auth.admin.getUserById(userId)
    const email = userRes?.user?.email
    if (email) {
      const base = process.env.APP_PUBLIC_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? ''
      const sent = await sendEmail({
        to: email,
        subject: '這週的回顧來了 · SnowRealm Space',
        html: weeklyRecapHtml(count, `${base}/insights`),
      })
      if (!sent.sent && sent.reason !== 'no_key') {
        console.error('[insight.weekly] email 未寄出', spaceId, sent.reason)
      }
    }
  }
}
