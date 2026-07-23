import { NextResponse } from 'next/server'
import { getDb } from '@/lib/supabase/server'
import { requireActiveSpace, requireUser } from '@/lib/auth/session'
import { maybeGenerateProactive } from '@/lib/daily/proactive'

export const dynamic = 'force-dynamic'

async function timeZoneOf(spaceId: string, fallback: string): Promise<string> {
  const db = await getDb()
  const { data } = await db.from('spaces').select('timezone').eq('id', spaceId).maybeSingle()
  return data?.timezone ?? fallback ?? 'Asia/Taipei'
}

/**
 * Agent 主動訊息：進 Home 時呼叫，若條件允許就產生今天的一則（頻率/quiet hours 由 lib 把關），
 * 並回傳最新一則 agent/milestone 訊息給 widget 顯示。
 */
export async function GET() {
  const user = await requireUser()
  const { space } = await requireActiveSpace()
  try {
    const tz = await timeZoneOf(space.id, space.timezone)
    await maybeGenerateProactive(space.id, user.id, tz)

    const db = await getDb()
    const { data } = await db
      .from('notifications')
      .select('title, body, created_at, category')
      .eq('user_id', user.id)
      .in('category', ['agent', 'milestone'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({
      data: data ? { title: data.title, body: data.body, at: data.created_at } : null,
    })
  } catch (err) {
    console.error('[api/agent/message] GET', err)
    return NextResponse.json({ data: null })
  }
}
