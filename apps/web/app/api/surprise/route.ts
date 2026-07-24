import { NextResponse } from 'next/server'
import { getDb } from '@/lib/supabase/server'
import { requireActiveSpace } from '@/lib/auth/session'
import { getSurpriseState, openSurprise } from '@snowrealm/daily-engine'

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
    return NextResponse.json({ data: await openSurprise(space.id, tz) })
  } catch (err) {
    console.error('[api/surprise] POST', err)
    return NextResponse.json({ error: { message: '開盒失敗，稍後再試。' } }, { status: 500 })
  }
}
