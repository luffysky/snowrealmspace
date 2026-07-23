/**
 * 重現註冊 → 進站的完整伺服器路徑（打 hosted DB），找出哪一步爆掉。
 * 用完會刪掉建立的測試帳號。
 */
import { createAdminClient } from '@snowrealm/db/server'
import { provisionSpaceForUser } from '@snowrealm/db/provisioning'
import { listIdentities, syncFromAuthIdentities } from '@snowrealm/db/identities'

async function step<T>(name: string, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    const r = await fn()
    console.log(`✓ ${name}`)
    return r
  } catch (e) {
    console.error(`✗ ${name} —— ${(e as Error).message}`)
    console.error((e as Error).stack)
    return undefined
  }
}

async function main() {
  const admin = createAdminClient()
  const username = `repro${Date.now().toString().slice(-6)}`
  const email = `${username}@users.snowrealm.pet`
  console.log(`測試帳號：${email}`)

  const created = await step('admin.createUser', async () => {
    const r = await admin.auth.admin.createUser({
      email,
      password: 'reprotest12345',
      email_confirm: true,
      user_metadata: { username },
    })
    if (r.error) throw r.error
    return r.data.user!
  })
  if (!created) return

  await step('provisionSpaceForUser', () =>
    provisionSpaceForUser({ userId: created.id, email, displayName: username }),
  )

  // 進站後 /settings/account 會跑的兩個
  await step('syncFromAuthIdentities', () => syncFromAuthIdentities(created.id))
  await step('listIdentities', () => listIdentities(created.id))

  // 我新加的橫幅判斷
  await step('user_identities 查詢（BindingReminder）', async () => {
    const { error } = await admin.from('user_identities').select('provider, email').eq('user_id', created.id)
    if (error) throw new Error(error.message)
  })

  // 清理
  await step('cleanup: delete space + user', async () => {
    const { data: m } = await admin.from('space_members').select('space_id').eq('user_id', created.id).maybeSingle()
    if (m) await admin.from('spaces').delete().eq('id', m.space_id)
    await admin.auth.admin.deleteUser(created.id)
  })
}

main().then(() => process.exit(0))
