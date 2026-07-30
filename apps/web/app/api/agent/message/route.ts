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
export async function GET(request: Request) {
  const user = await requireUser()
  await requireActiveSpace()

  // maxMessages 設定（agent_message widget）：1–5，預設 1。回傳最新 N 則。
  const rawLimit = Number(new URL(request.url).searchParams.get('limit'))
  const limit = Number.isFinite(rawLimit) ? Math.min(5, Math.max(1, Math.round(rawLimit))) : 1

  try {
    const db = await getDb()
    const { data } = await db
      .from('notifications')
      .select('title, body, created_at, category')
      .eq('user_id', user.id)
      .in('category', ['agent', 'milestone'])
      .order('created_at', { ascending: false })
      .limit(limit)

    const rows = (data ?? []).filter((r) => r.body)
    const messages = rows.map((r) => ({ title: r.title, body: r.body, at: r.created_at }))

    return NextResponse.json({
      // 相容：data 仍是最新一則（舊呼叫者用），messages 是完整清單（新 widget 用）
      data: messages[0] ?? null,
      messages,
    })
  } catch (err) {
    console.error('[api/agent/message] GET', err)
    return NextResponse.json({ data: null, messages: [] })
  }
}
