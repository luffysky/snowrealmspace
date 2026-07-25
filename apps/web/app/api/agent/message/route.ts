import { NextResponse } from 'next/server'
import { getDb } from '@/lib/supabase/server'
import { requireActiveSpace, requireUser } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

/**
 * Agent 主動訊息：**只讀**最新一則 agent/milestone 訊息給 widget 顯示。
 *
 * 產生改由 worker cron（daily-cron.ts）掃時區冪等生成，這裡不再生成——
 * 否則「進 Home 生成」與「cron 生成」兩條路徑會競態、可能一天多送（proactive 沒有 unique 約束）。
 */
export async function GET() {
  const user = await requireUser()
  await requireActiveSpace()
  try {
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
