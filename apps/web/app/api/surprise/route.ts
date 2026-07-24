import { NextResponse } from 'next/server'
import { getDb } from '@/lib/supabase/server'
import { requireActiveSpace, getUser } from '@/lib/auth/session'
import { getSurpriseState, openSurprise } from '@snowrealm/daily-engine'
import { emitEvent } from '@snowrealm/analytics'

export const dynamic = 'force-dynamic'

async function timeZoneOf(spaceId: string, fallback: string): Promise<string> {
  const db = await getDb()
  const { data } = await db.from('spaces').select('timezone').eq('id', spaceId).maybeSingle()
  return data?.timezone ?? fallback ?? 'Asia/Taipei'
}

/** 今天的驚喜狀態。 */
export async function GET() {
  const { space } = await requireActiveSpace()
  try {
    const tz = await timeZoneOf(space.id, space.timezone)
    return NextResponse.json({ data: await getSurpriseState(space.id, tz) })
  } catch (err) {
    console.error('[api/surprise] GET', err)
    return NextResponse.json({ data: { state: 'empty' } })
  }
}

/** 開盒。 */
export async function POST() {
  const { space } = await requireActiveSpace()
  try {
    const tz = await timeZoneOf(space.id, space.timezone)
    // 記錄「這次真的開了新盒」才發事件（重複 POST 不重複記）。
    const before = await getSurpriseState(space.id, tz)
    const view = await openSurprise(space.id, tz)

    const user = await getUser()
    if (before.state !== 'opened' && view.state === 'opened' && user) {
      const db = await getDb()
      const { data: row } = await db
        .from('surprises')
        .select('id')
        .eq('space_id', space.id)
        .order('unlocked_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      // surprise.unlocked → 時間軸投影（rare 以上才顯示；見 timeline-projection）。
      // 之前完全沒有 emit 端，所以驚喜從不進時間軸——這裡補上。actor 必須是真使用者
      // （activity_events.actor_id → auth.users）。
      await emitEvent('surprise.unlocked', space.id, user.id, {
        surpriseId: row?.id ?? '',
        rarity: view.rarity,
        chainKey: null,
      })
    }

    return NextResponse.json({ data: view })
  } catch (err) {
    console.error('[api/surprise] POST', err)
    return NextResponse.json({ error: { message: '開盒失敗，稍後再試。' } }, { status: 500 })
  }
}
