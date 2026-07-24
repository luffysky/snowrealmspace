import { getDb } from '@/lib/supabase/server'

/**
 * 站台級管理身份（照 ai 島 checkOwner 的多 signal 方式）。
 *
 * 管理全域資源（AI provider 金鑰、模型清單）需要的是「站台站長」身份，
 * 不是某個 space 的 owner —— 後者只管自己的空間。
 *
 * 多 signal：任一命中即站台管理員，且有安全 fallback（就算 env 沒設也認得站長）：
 *   1. auth email 在 OWNER_EMAILS（env csv，預設 luffysky00@gmail.com）
 *   2. user id 在 OWNER_USER_IDS（env csv）
 *   3. username（user_metadata.username）在 OWNER_USERNAMES（env csv，預設 luffysky00,luffysky004）
 *
 * 換 signal 只改 env、不動程式。
 */

function csv(v: string | undefined): string[] {
  return (v ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

const DEFAULT_OWNER_EMAILS = ['luffysky00@gmail.com']
const DEFAULT_OWNER_USERNAMES = ['luffysky00', 'luffysky004']

export type SiteAdminResult =
  | { ok: true; userId: string; email: string | null; signals: string[] }
  | { ok: false; reason: 'unauthenticated' | 'forbidden' }

export async function checkSiteAdmin(): Promise<SiteAdminResult> {
  const db = await getDb()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return { ok: false, reason: 'unauthenticated' }

  const email = (user.email ?? '').toLowerCase()
  const username = String(
    (user.user_metadata as { username?: string } | null)?.username ?? '',
  ).toLowerCase()

  const emails = csv(process.env.OWNER_EMAILS).length ? csv(process.env.OWNER_EMAILS) : DEFAULT_OWNER_EMAILS
  const userIds = csv(process.env.OWNER_USER_IDS)
  const usernames = csv(process.env.OWNER_USERNAMES).length
    ? csv(process.env.OWNER_USERNAMES)
    : DEFAULT_OWNER_USERNAMES

  const signals: string[] = []
  if (email && emails.includes(email)) signals.push('email')
  if (userIds.includes(user.id.toLowerCase())) signals.push('userId')
  if (username && usernames.includes(username)) signals.push('username')

  if (signals.length === 0) return { ok: false, reason: 'forbidden' }
  return { ok: true, userId: user.id, email: user.email ?? null, signals }
}

export async function isSiteAdmin(): Promise<boolean> {
  return (await checkSiteAdmin()).ok
}
