import { config } from 'dotenv'
import { createAdminClient } from '@snowrealm/db/server'

/**
 * 清掉漏建到 hosted 的測試使用者（@e2e.local / @rls-test.local / example.com）。
 *
 * 一次性維護腳本。刪使用者前要先刪掉他們的 space（cascade 掉 activity_events），
 * 否則 activity_events.actor_id 的外鍵會擋住刪除。
 */

config({ path: '.env.local' })
config({ path: '.env' })

const PATTERNS = [/@e2e\.local$/i, /@rls-test\.local$/i, /@example\.com$/i]
const isTest = (email?: string | null) => !!email && PATTERNS.some((re) => re.test(email))

const admin = createAdminClient()

let deleted = 0
let failed = 0

// listUsers 分頁
for (let page = 1; page <= 20; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
  if (error) {
    console.error('listUsers 失敗：', error.message)
    break
  }
  if (data.users.length === 0) break

  const targets = data.users.filter((u) => isTest(u.email))
  for (const user of targets) {
    // 先刪這個人的 space（cascade activity_events / space_members / 其他 space 資料）
    const { data: memberships } = await admin
      .from('space_members')
      .select('space_id')
      .eq('user_id', user.id)
    for (const m of memberships ?? []) {
      await admin.from('spaces').delete().eq('id', m.space_id)
    }
    // 保險：清掉直接以此人為 actor 的 activity_events（跨 space 的殘留）
    await admin.from('activity_events').delete().eq('actor_id', user.id)

    const { error: delErr } = await admin.auth.admin.deleteUser(user.id)
    if (delErr) {
      console.error(`✗ 刪不掉 ${user.email}：${delErr.message}`)
      failed++
    } else {
      deleted++
    }
  }

  if (data.users.length < 200) break
}

console.log(`\n✓ 刪除測試使用者 ${deleted} 個${failed ? `，失敗 ${failed} 個` : ''}`)
