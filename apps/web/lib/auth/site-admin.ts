import { getDb } from '@/lib/supabase/server'
import { createAdminClient } from '@snowrealm/db/server'

/**
 * 站台級管理身份（參照 AI 島平台角色）。
 *
 * 管理全域資源（AI 金鑰、模型、使用者）需要「站台站長／管理員」身份，
 * 不是某個 space 的 owner。
 *
 * 判定順序（任一成立即通過）：
 *   1. **DB 角色**：profiles.site_role ∈ {owner, admin}（真相來源，可由 owner 在後台調整）
 *   2. **env 保險絲**：email/username/userId 命中 OWNER_*（預設含 luffysky00@gmail.com）
 *      —— 就算 DB 角色沒設好也認得站長，永遠不會把自己鎖在外面。
 *
 * env 命中者一律視為 owner（最高權限的保險絲）。
 */

function csv(v: string | undefined): string[] {
  return (v ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

const DEFAULT_OWNER_EMAILS = ['luffysky00@gmail.com']
const DEFAULT_OWNER_USERNAMES = ['luffysky00', 'luffysky004']

export type SiteRole = 'owner' | 'admin'

export type SiteAdminResult =
  | { ok: true; userId: string; email: string | null; role: SiteRole; privileged: boolean; signals: string[] }
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

  // 1) DB 角色（用 service role 讀，避免 profiles 的 RLS 影響判定）
  let dbRole: 'owner' | 'admin' | 'member' | null = null
  let privileged = false
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('profiles')
      .select('site_role, privileged')
      .eq('id', user.id)
      .maybeSingle<{ site_role: string; privileged: boolean }>()
    if (data) {
      dbRole = data.site_role === 'owner' ? 'owner' : data.site_role === 'admin' ? 'admin' : 'member'
      privileged = Boolean(data.privileged)
    }
  } catch {
    // DB 讀不到就只靠 env 保險絲（不擋站長）
  }

  const signals: string[] = []
  if (dbRole === 'owner' || dbRole === 'admin') signals.push(`db:${dbRole}`)

  // 2) env 保險絲（一律當 owner）
  const emails = csv(process.env.OWNER_EMAILS).length ? csv(process.env.OWNER_EMAILS) : DEFAULT_OWNER_EMAILS
  const userIds = csv(process.env.OWNER_USER_IDS)
  const usernames = csv(process.env.OWNER_USERNAMES).length
    ? csv(process.env.OWNER_USERNAMES)
    : DEFAULT_OWNER_USERNAMES
  if (email && emails.includes(email)) signals.push('env:email')
  if (userIds.includes(user.id.toLowerCase())) signals.push('env:userId')
  if (username && usernames.includes(username)) signals.push('env:username')

  const envHit = signals.some((s) => s.startsWith('env:'))
  if (signals.length === 0) return { ok: false, reason: 'forbidden' }

  // env 命中 → owner（保險絲最高權）；否則用 DB 角色
  const role: SiteRole = envHit || dbRole === 'owner' ? 'owner' : 'admin'
  return { ok: true, userId: user.id, email: user.email ?? null, role, privileged, signals }
}

export async function isSiteAdmin(): Promise<boolean> {
  return (await checkSiteAdmin()).ok
}
