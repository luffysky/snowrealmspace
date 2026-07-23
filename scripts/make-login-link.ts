import { config } from 'dotenv'
import { createAdminClient } from '@snowrealm/db/server'
import { createInvite } from '@snowrealm/db/provisioning'

/**
 * 產生一條可直接登入的 magic link（不經寄信）。
 *
 * 用於 SMTP 還沒設好、但想先進去看 app 的情況。
 * 走 service role，redirectTo 帶上邀請 token（若使用者還沒有 space）。
 *
 * 用法：pnpm tsx scripts/make-login-link.ts <email>
 */

config({ path: '.env.local' })
config({ path: '.env' })

const EMAIL = process.argv[2] ?? 'luffysky00@gmail.com'
const APP = process.env.NEXT_PUBLIC_APP_URL ?? 'https://snowrealm-space.snowrealm.pet'

const admin = createAdminClient()

// 1) 確保使用者存在（email 直接標記已確認，跳過驗證信）
const list = await admin.auth.admin.listUsers()
let user = list.data.users.find((u) => u.email?.toLowerCase() === EMAIL.toLowerCase())
if (!user) {
  const created = await admin.auth.admin.createUser({ email: EMAIL, email_confirm: true })
  if (created.error) {
    console.error('建立使用者失敗：', created.error.message)
    process.exit(1)
  }
  user = created.data.user
  console.log('✓ 已建立使用者', EMAIL)
} else {
  console.log('· 使用者已存在', EMAIL)
}

// 2) 沒有 space 就建邀請（callback 需要）
const { data: membership } = await admin
  .from('space_members')
  .select('space_id')
  .eq('user_id', user!.id)
  .limit(1)
  .maybeSingle()

let inviteParam = ''
if (!membership) {
  const invite = await createInvite({ email: EMAIL })
  inviteParam = `&invite=${invite.token}`
  console.log('✓ 已建立邀請')
} else {
  console.log('· 已是某 space 成員')
}

// 3) 產生 magic link
const redirectTo = `${APP}/auth/callback?next=/home${inviteParam}`
const link = await admin.auth.admin.generateLink({
  type: 'magiclink',
  email: EMAIL,
  options: { redirectTo },
})
if (link.error) {
  console.error('產生連結失敗：', link.error.message)
  process.exit(1)
}

console.log('\n=== 點這條連結登入（1 小時內有效）===\n')
console.log(link.data.properties?.action_link)
console.log('')
