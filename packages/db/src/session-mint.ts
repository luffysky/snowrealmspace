import { createAdminClient, type Db } from './server.js'

/**
 * 為既有使用者建立 session，不需要他點信裡的連結。
 *
 * 為什麼需要這個：LINE 不是 Supabase 支援的 provider，
 * `signInWithOAuth` / `signInWithIdToken` 都走不通。我們在自己的
 * callback 驗證完 LINE 身分之後，必須有辦法把「這個人是誰」
 * 轉換成一個真正的 Supabase session。
 *
 * 做法是 admin 產生一次性的 magic link token，再立刻用掉。
 * 這是 Supabase 官方給自訂 provider 的路徑。
 *
 * ⚠️ 這支等同於「不需密碼就能登入任何人」。
 * 呼叫端**必須**已經完整驗證過第三方身分（state、nonce、id_token 簽章），
 * 而且只能用已綁定的身分反查出來的 userId，絕不可接受外部輸入的 email。
 */
export async function mintSessionForUser(
  userClient: Db,
  userId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const admin = createAdminClient()

  const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId)
  if (userError || !userData.user) return { ok: false, reason: 'user_not_found' }

  const email = userData.user.email
  // 沒有 email 的帳號在 Alpha 不存在（§6：LINE 不支援註冊），
  // 但真的遇到時要明確失敗，而不是繼續往下拋一個難懂的錯。
  if (!email) return { ok: false, reason: 'no_email' }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (linkError || !link.properties?.hashed_token) {
    return { ok: false, reason: 'link_generation_failed' }
  }

  // verifyOtp 走 user client，成功時 cookie 由 @supabase/ssr 寫入
  const { error: verifyError } = await userClient.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: 'email',
  })
  if (verifyError) return { ok: false, reason: 'verify_failed' }

  return { ok: true }
}
