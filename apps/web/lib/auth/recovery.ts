import { createAdminClient } from '@snowrealm/db/server'

const USERNAME_DOMAIN = 'users.snowrealm.pet'

/**
 * 這個帳號有沒有「找得回來」的方式？
 *
 * 沒有的話（純使用者名稱、沒綁 email/Google/LINE），忘記密碼就無解，
 * 所以要在進站時提醒綁定。一旦綁了任何一種，就不再提醒。
 *
 * 有 recovery 的條件：
 *   - 帳號本身是真 email（不是合成的 <name>@users.snowrealm.pet），或
 *   - 綁了 Google / LINE，或
 *   - 綁了一個真 email 的 email identity
 */
export async function accountHasRecovery(
  userId: string,
  email: string | null | undefined,
): Promise<boolean> {
  const realPrimaryEmail = Boolean(email) && !email!.endsWith(`@${USERNAME_DOMAIN}`)
  if (realPrimaryEmail) return true

  const admin = createAdminClient()
  const { data } = await admin
    .from('user_identities')
    .select('provider, email')
    .eq('user_id', userId)

  return (data ?? []).some((row) => {
    if (row.provider === 'google' || row.provider === 'line') return true
    if (row.provider === 'email' && row.email && !row.email.endsWith(`@${USERNAME_DOMAIN}`)) {
      return true
    }
    return false
  })
}
