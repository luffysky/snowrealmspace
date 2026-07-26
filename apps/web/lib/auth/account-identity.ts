/**
 * 帳號的對外識別。
 *
 * 純使用者名稱註冊的帳號，內部會映射成合成 email（`<name>@users.snowrealm.pet`）
 * 只為了讓 Supabase Auth 有 email 欄位可用 —— 那**不是真的信箱、不能收信、不該對外顯示**。
 *
 * 這個函式把「內部登入識別」翻譯成「使用者看得懂的身分」：
 *   - 合成 email → 顯示帳號（使用者名稱），標籤是「帳號」
 *   - 真 email → 顯示 email，標籤是「Email」
 *
 * UI 一律用這個，不要直接印 `user.email`。
 */

const USERNAME_DOMAIN = 'users.snowrealm.pet'

export type AccountIdentity = {
  /** 'username' = 純帳號（合成 email）；'email' = 真信箱 */
  kind: 'username' | 'email'
  /** 顯示用標籤 */
  label: string
  /** 顯示用值：帳號名或 email */
  value: string
}

export function isSyntheticEmail(email: string | null | undefined): boolean {
  return Boolean(email) && email!.toLowerCase().endsWith(`@${USERNAME_DOMAIN}`)
}

export function accountIdentity(
  email: string | null | undefined,
  username?: string | null,
): AccountIdentity {
  if (isSyntheticEmail(email)) {
    return {
      kind: 'username',
      label: '帳號',
      value: username?.trim() || email!.split('@')[0]!,
    }
  }
  return { kind: 'email', label: 'Email', value: email ?? '' }
}
