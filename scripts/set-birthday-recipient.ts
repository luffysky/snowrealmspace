/**
 * 把某個帳號的空間設為「生日主角」（看得到生日鏈，其餘人看歡迎信）。
 *
 *   pnpm tsx scripts/set-birthday-recipient.ts <email 或 space uuid> [on|off]
 *
 * 預設 on。找 email → 該使用者名下的 space。
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { createAdminClient } from '@snowrealm/db/server'

const arg = process.argv[2]
const onoff = (process.argv[3] ?? 'on').toLowerCase()
const value = onoff !== 'off'

if (!arg) {
  console.error('用法：pnpm tsx scripts/set-birthday-recipient.ts <email 或 space uuid> [on|off]')
  process.exit(1)
}

const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(arg)

async function main() {
  const admin = createAdminClient()
  let spaceId = isUuid ? arg : null

  if (!spaceId) {
    // 用 email 找使用者 → 名下的 space
    const { data: users } = await admin.auth.admin.listUsers()
    const user = users.users.find((u) => u.email?.toLowerCase() === arg.toLowerCase())
    if (!user) {
      console.error(`找不到 email 為 ${arg} 的使用者`)
      process.exit(1)
    }
    const { data: space } = await admin
      .from('spaces')
      .select('id, name')
      .eq('owner_id', user.id)
      .is('deleted_at', null)
      .maybeSingle()
    if (!space) {
      console.error('這個使用者名下沒有空間')
      process.exit(1)
    }
    spaceId = space.id
    console.log(`找到空間「${space.name}」（${spaceId}）`)
  }

  const { error } = await admin
    .from('space_settings')
    .update({ is_birthday_recipient: value })
    .eq('space_id', spaceId)
  if (error) {
    console.error('更新失敗：', error.message)
    process.exit(1)
  }
  console.log(`✓ 已將 space ${spaceId} 的「生日主角」設為 ${value ? 'ON（看生日鏈）' : 'OFF（看歡迎信）'}`)
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
