import type { NextRequest } from 'next/server'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, handler } from '@/lib/api/respond'
import type { Db } from '@snowrealm/db/server'

export const dynamic = 'force-dynamic'

/**
 * 創作連續天數：由 activity_events（actor_type='user'）算，非另存一張表。
 * 「連續」以 space 當地日期為單位；今天還沒動也不算斷（寬限到昨天）。
 */

function localDateString(ts: string, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(ts))
}

function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y!, (m! - 1), d!))
  dt.setUTCDate(dt.getUTCDate() + delta)
  return dt.toISOString().slice(0, 10)
}

async function tzOf(db: Db, spaceId: string): Promise<string> {
  const { data } = await db.from('spaces').select('timezone').eq('id', spaceId).maybeSingle()
  return data?.timezone ?? 'Asia/Taipei'
}

export const GET = handler(async (request: NextRequest) => {
  const result = await resolveContext()
  if (!result.ok) return fail(result.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '沒有存取權。')
  const { ctx } = result
  const tz = await tzOf(ctx.db, ctx.spaceId)

  // 統計視窗天數（creative_streak widget 的 windowDays 設定）：7–90，預設 30。
  const rawDays = Number(new URL(request.url).searchParams.get('days'))
  const windowDays = Number.isFinite(rawDays) ? Math.min(90, Math.max(7, Math.round(rawDays))) : 30

  // 取最近 120 天的使用者活動，足以涵蓋任何合理連續天數。
  const since = new Date(Date.now() - 120 * 24 * 3600 * 1000).toISOString()
  const { data } = await ctx.db
    .from('activity_events')
    .select('occurred_at')
    .eq('space_id', ctx.spaceId)
    .eq('actor_type', 'user')
    .gte('occurred_at', since)
    .order('occurred_at', { ascending: false })
    .limit(2000)

  const days = new Set<string>()
  for (const row of data ?? []) {
    if (row.occurred_at) days.add(localDateString(row.occurred_at, tz))
  }

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date())
  const yesterday = addDays(today, -1)

  // 起點：今天有動 → 從今天；今天沒動但昨天有 → 從昨天（寬限）；否則連續為 0。
  let cursor: string | null = days.has(today) ? today : days.has(yesterday) ? yesterday : null
  let streak = 0
  while (cursor && days.has(cursor)) {
    streak += 1
    cursor = addDays(cursor, -1)
  }

  return ok({
    streak,
    activeToday: days.has(today),
    windowDays,
    activeDaysWindow: Array.from(days).filter((d) => d > addDays(today, -windowDays)).length,
    // 保留 activeDays30 給既有呼叫者相容
    activeDays30: Array.from(days).filter((d) => d > addDays(today, -30)).length,
  })
})
