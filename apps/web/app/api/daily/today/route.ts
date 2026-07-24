import { NextResponse } from 'next/server'
import { getDb } from '@/lib/supabase/server'
import { requireActiveSpace } from '@/lib/auth/session'
import { getTodayContent } from '@snowrealm/daily-engine'

export const dynamic = 'force-dynamic'

/**
 * 今天的每日內容（問候 + 語錄 + 創作提示）。
 *
 * 第一次於當天呼叫時會**順便生成**（09-content-pool.md）——
 * 使用者一進來就有內容，不必等 cron。生成走 service role（service.ts），
 * 讀取的資格由 requireActiveSpace 把關。
 */
export async function GET() {
  const { space } = await requireActiveSpace()

  // 用 space 時區決定「今天」與問候時段
  const db = await getDb()
  const { data } = await db
    .from('spaces')
    .select('timezone')
    .eq('id', space.id)
    .maybeSingle()
  const timeZone = data?.timezone ?? space.timezone ?? 'Asia/Taipei'

  try {
    const content = await getTodayContent(space.id, timeZone)
    return NextResponse.json({ data: content })
  } catch (err) {
    console.error('[daily/today] 失敗', err)
    // 每日內容是錦上添花，壞掉不該讓 Home 整個崩 —— 回空內容，widget 自己降級
    return NextResponse.json({
      data: { greeting: null, quote: null, prompt: null },
    })
  }
}
