import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { ADMIN_BASE } from '@/lib/admin-path'
import { createAdminClient } from '@snowrealm/db/server'
import { resolveAvatarUrls } from '@/lib/avatar'
import { UsersAdmin, type UserRow } from './UsersAdmin'

export const metadata: Metadata = { title: '使用者管理 — SnowRealm' }
export const dynamic = 'force-dynamic'

/**
 * 使用者管理：站台角色（owner/admin/member）與特權。
 * 只有 owner 能改（admin 檢視）。owner 唯一、admin 給 Nami、其餘 member。
 */
export default async function AdminUsersPage() {
  const gate = await checkSiteAdmin()
  if (!gate.ok) redirect(gate.reason === 'unauthenticated' ? `/login?next=${ADMIN_BASE}/users` : '/home')

  const admin = createAdminClient()
  const [{ data: authList }, { data: profileData }, { data: sessionData }] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 200 }),
    admin.from('profiles').select('id, display_name, site_role, privileged, avatar_asset_id'),
    // 每人最近的上線資訊：一次撈近期 session（新到舊），下面 reduce 成每 user 的最新一筆，避免 N+1。
    // 一條查詢＋依 last_seen_at desc 排序 → 每個 user_id 第一次出現即最新，Map 去重即可（無 per-user 查詢）。
    admin
      .from('user_sessions')
      .select('user_id, last_seen_at, country, region, city, device_type, browser, os')
      .order('last_seen_at', { ascending: false })
      .limit(1000),
  ])

  // user_id → 最新一筆 session（已依 last_seen_at desc 排序，第一次見到即最新）
  type SessionRow = NonNullable<typeof sessionData>[number]
  const latestSessionOf = new Map<string, SessionRow>()
  for (const s of sessionData ?? []) {
    if (s.user_id && !latestSessionOf.has(s.user_id)) latestSessionOf.set(s.user_id, s)
  }

  const roleOf = new Map(
    (profileData ?? []).map((p) => [
      p.id,
      {
        role: (p.site_role as string) ?? 'member',
        privileged: Boolean(p.privileged),
        name: p.display_name,
        avatarAssetId: (p as { avatar_asset_id?: string | null }).avatar_asset_id ?? null,
      },
    ]),
  )

  // 跨 space 頭像：用 admin client 繞 RLS 批次解 signed URL（已 checkSiteAdmin 過）
  const avatarUrls = await resolveAvatarUrls(
    admin,
    (profileData ?? []).map((p) => (p as { avatar_asset_id?: string | null }).avatar_asset_id ?? null),
  )

  const users: UserRow[] = (authList?.users ?? []).map((u) => {
    const p = roleOf.get(u.id)
    // 每人最新一筆 session（可能為 null：使用者尚未在部署了 heartbeat 的版本上線過 → 地區/裝置留空，前端顯示「—」）
    const sess = latestSessionOf.get(u.id) ?? null
    return {
      id: u.id,
      email: u.email ?? null,
      username: ((u.user_metadata as { username?: string } | null)?.username ?? null) as string | null,
      displayName: (p?.name ?? null) as string | null,
      siteRole: (p?.role === 'owner' || p?.role === 'admin' ? p.role : 'member') as UserRow['siteRole'],
      privileged: p?.privileged ?? false,
      avatarUrl: p?.avatarAssetId ? (avatarUrls.get(p.avatarAssetId) ?? null) : null,
      lastSeenAt: sess?.last_seen_at ?? null,
      country: sess?.country ?? null,
      region: sess?.region ?? null,
      city: sess?.city ?? null,
      deviceType: sess?.device_type ?? null,
      browser: sess?.browser ?? null,
      os: sess?.os ?? null,
    }
  })

  // owner / admin 先排前面
  const rank = { owner: 0, admin: 1, member: 2 }
  users.sort((a, b) => rank[a.siteRole] - rank[b.siteRole])

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 'var(--sr-space-6) var(--sr-space-4)' }}>
      <p className="sr-muted">
        <Link href={ADMIN_BASE} className="sr-link">
          ← 管理後台
        </Link>
      </p>
      <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>使用者管理</h1>
      <p className="sr-muted">
        站台角色與特權。owner 唯一（你）、admin 可進後台、member 一般使用者。
        特權＝免費使用全站資源（AI 等）。{gate.role === 'owner' ? '你是 owner，可調整。' : '你是 admin，僅能檢視。'}
      </p>

      <UsersAdmin initial={users} isOwner={gate.role === 'owner'} selfId={gate.userId} adminBase={ADMIN_BASE} />
    </main>
  )
}
