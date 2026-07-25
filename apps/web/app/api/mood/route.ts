import type { NextRequest } from 'next/server'
import { moodUpsertSchema } from '@snowrealm/validation'
import type { Db } from '@snowrealm/db/server'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

/** 該 space 當地日期（心情一天一筆，用當地日期當 key）。 */
async function localDateOf(db: Db, spaceId: string): Promise<string> {
  const { data } = await db.from('spaces').select('timezone').eq('id', spaceId).maybeSingle()
  const tz = data?.timezone ?? 'Asia/Taipei'
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date())
}

/** 今天的心情 + 最近 30 天歷史。 */
export const GET = handler(async () => {
  const result = await resolveContext()
  if (!result.ok) return fail(result.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '沒有存取權。')
  const { ctx } = result
  const today = await localDateOf(ctx.db, ctx.spaceId)

  const { data: todayRow } = await ctx.db
    .from('mood_entries')
    .select('mood, note, local_date')
    .eq('space_id', ctx.spaceId)
    .eq('local_date', today)
    .maybeSingle()

  const { data: history } = await ctx.db
    .from('mood_entries')
    .select('local_date, mood')
    .eq('space_id', ctx.spaceId)
    .order('local_date', { ascending: false })
    .limit(30)

  return ok({ todayDate: today, today: todayRow ?? null, history: history ?? [] })
})

/** 打卡今天的心情（覆寫式 upsert）。 */
export const PUT = handler(async (request: NextRequest) => {
  const result = await resolveContext()
  if (!result.ok) return fail(result.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '沒有存取權。')
  const { ctx } = result
  const body: unknown = await request.json().catch(() => null)
  const parsed = moodUpsertSchema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)

  const today = await localDateOf(ctx.db, ctx.spaceId)
  const { error } = await ctx.db.from('mood_entries').upsert(
    {
      space_id: ctx.spaceId,
      local_date: today,
      mood: parsed.data.mood,
      note: parsed.data.note,
      created_by: ctx.userId,
    },
    { onConflict: 'space_id,local_date' },
  )
  if (error) return fail('INTERNAL', '存不了今天的心情，請稍後再試。')
  return ok({ todayDate: today, mood: parsed.data.mood, note: parsed.data.note })
})
