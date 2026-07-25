import type { Db } from '@snowrealm/db/server'

/**
 * 身份抽象層（ADR-024）。
 *
 * **全站唯一讀取「目前登入者原始身份」的地方。** feature code 一律走
 * session.ts 的 getUser()/requireUser() 或 api/context.ts 的 resolveContext()，
 * 不直接呼叫 `supabase.auth.getUser()`。
 *
 * 未來把身份來源從 Supabase Auth 換成 SnowRealm SSO（snowrealm-id OIDC）時，
 * 只需要改這一個函式——驗 SnowRealm 簽發的 JWT、對出 snowrealm_id、再映射到本地帳號。
 * 其餘所有呼叫端都不用動。
 */

export type Identity = {
  id: string
  email: string | null
  /** email 是否已驗證。ADR-024：帳號綁定只能用已驗證 email。 */
  emailVerified: boolean
  /** 使用者名稱（Supabase user_metadata；未來由 SSO claims 提供）。 */
  username: string | null
}

/** 讀目前 session 的身份（受 RLS 的 client）。未登入回 null。 */
export async function readSessionIdentity(db: Db): Promise<Identity | null> {
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return null
  const username = (user.user_metadata as { username?: string } | null)?.username
  return {
    id: user.id,
    email: user.email ?? null,
    // Supabase：email_confirmed_at 有值即已驗證
    emailVerified: Boolean((user as { email_confirmed_at?: string | null }).email_confirmed_at),
    username: typeof username === 'string' ? username : null,
  }
}

/**
 * 讀這個本地帳號綁定的 snowrealm_id（ADR-024）。發證方上線前一律回 null。
 * 未來 SSO 登入時：驗 JWT → 取 sub → 反查哪個本地帳號的 snowrealm_id = sub。
 */
export async function readLinkedSnowrealmId(db: Db, userId: string): Promise<string | null> {
  const { data } = await db.from('profiles').select('snowrealm_id').eq('id', userId).maybeSingle()
  return data?.snowrealm_id ?? null
}
