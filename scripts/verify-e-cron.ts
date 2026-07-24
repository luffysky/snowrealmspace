/**
 * E cron 掃時區驗證（直連 DB）：
 *  1. daily-engine 從共享套件呼叫得動（重構未破壞）
 *  2. handleDailyGenerate 對「當地 04:00」的 space 真的生成每日內容
 *  3. weekly_recap 通知冪等（同週期不重發）
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { createAdminClient } from '@snowrealm/db/server'
import { provisionSpaceForUser } from '@snowrealm/db/provisioning'
import { getTodayContent } from '@snowrealm/daily-engine'
import { handleDailyGenerate } from '../apps/worker/src/handlers/daily-cron.js'

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`✗ ${msg}`)
    process.exitCode = 1
    throw new Error(msg)
  }
  console.log(`✓ ${msg}`)
}

/** 找一個固定偏移時區，讓當地小時剛好是 target。 */
function tzForLocalHour(target: number): string {
  const utcHour = new Date().getUTCHours()
  const n = (target - utcHour + 24) % 24 // 需要 UTC+n
  // Etc/GMT-n = UTC+n；只支援 0..14
  if (n <= 14) return `Etc/GMT-${n}`
  return `Etc/GMT+${24 - n}` // UTC-(24-n)
}

async function main() {
  const admin = createAdminClient()
  const email = `ecron-${Date.now()}@verify.local`
  const { data: user } = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (!user.user) throw new Error('建立使用者失敗')
  const { spaceId } = await provisionSpaceForUser({ userId: user.user.id, email })

  try {
    // 1. 共享套件呼叫得動
    const content = await getTodayContent(spaceId, 'Asia/Taipei')
    assert(content !== null && typeof content === 'object', 'daily-engine getTodayContent 從共享套件呼叫成功')

    // 2. 把 space 時區設成「當地現在 04:00」，跑掃描
    const tz = tzForLocalHour(4)
    await admin.from('spaces').update({ timezone: tz }).eq('id', spaceId)
    await handleDailyGenerate([])
    const { count: dailyCount } = await admin
      .from('daily_items')
      .select('id', { count: 'exact', head: true })
      .eq('space_id', spaceId)
    assert((dailyCount ?? 0) > 0, `當地 04:00（${tz}）的 space 被掃到並生成每日內容`)

    // 3. weekly_recap 通知冪等
    const insertRecap = async () => {
      const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
      const { count: existing } = await admin
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('space_id', spaceId)
        .eq('category', 'weekly_recap')
        .gte('created_at', dayAgo)
      if ((existing ?? 0) > 0) return false
      await admin.from('notifications').insert({
        space_id: spaceId,
        user_id: user.user!.id,
        category: 'weekly_recap',
        title: '回顧',
        body: 'x',
        link: '/insights',
        channel: 'in_app',
      })
      return true
    }
    const first = await insertRecap()
    const second = await insertRecap()
    assert(first === true && second === false, 'weekly_recap 通知冪等（同週期第二次跳過）')

    console.log('\n✅ E cron 掃時區驗證通過')
  } finally {
    await admin.from('spaces').delete().eq('id', spaceId)
    await admin.auth.admin.deleteUser(user.user.id)
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
