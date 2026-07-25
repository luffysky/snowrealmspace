import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { ADMIN_BASE } from '@/lib/admin-path'
import { createAdminClient } from '@snowrealm/db/server'
import { OrphanRepair } from './OrphanRepair'

export const metadata: Metadata = { title: 'Space／使用者 — SnowRealm' }
export const dynamic = 'force-dynamic'

type SpaceRow = {
  id: string
  name: string
  slug: string
  owner_id: string
  privacy: string
  created_at: string
  deleted_at: string | null
}
type MemberRow = { space_id: string; user_id: string; role: string }
type ProfileRow = { id: string; display_name: string | null; created_at: string; locale: string }
type IdentityRow = { user_id: string; provider: string; email: string | null }

/**
 * Space／使用者總覽（唯讀，站台管理員）。
 * 授權一律 space_id（ADR-006）；這頁只讀不寫，不提供刪除/停用（那些是危險操作，
 * 走使用者自己的資料權流程，不放在管理面板隨手點）。
 */
export default async function AdminSpacesPage() {
  const gate = await checkSiteAdmin()
  if (!gate.ok) redirect(gate.reason === 'unauthenticated' ? `/login?next=${ADMIN_BASE}/spaces` : '/home')

  const admin = createAdminClient()
  const [{ data: spaceData }, { data: memberData }, { data: profileData }, { data: identityData }, { data: settingsData }] =
    await Promise.all([
      admin
        .from('spaces')
        .select('id, name, slug, owner_id, privacy, created_at, deleted_at')
        .order('created_at', { ascending: false })
        .limit(300),
      admin.from('space_members').select('space_id, user_id, role').limit(2000),
      admin.from('profiles').select('id, display_name, created_at, locale').order('created_at', { ascending: false }).limit(500),
      admin.from('user_identities').select('user_id, provider, email').limit(1000),
      admin.from('space_settings').select('space_id').limit(2000),
    ])

  const spaces = (spaceData ?? []) as SpaceRow[]
  const members = (memberData ?? []) as MemberRow[]
  const profiles = (profileData ?? []) as ProfileRow[]
  const identities = (identityData ?? []) as IdentityRow[]

  const nameOf = new Map(profiles.map((p) => [p.id, p.display_name ?? '（未命名）']))
  const memberCount = new Map<string, number>()
  for (const m of members) memberCount.set(m.space_id, (memberCount.get(m.space_id) ?? 0) + 1)
  const identOf = new Map<string, string[]>()
  for (const i of identities) {
    const list = identOf.get(i.user_id) ?? []
    list.push(i.provider)
    identOf.set(i.user_id, list)
  }

  const liveSpaces = spaces.filter((s) => !s.deleted_at)
  const deletedSpaces = spaces.filter((s) => s.deleted_at)

  // 孤兒偵測
  const usersWithSpace = new Set(members.map((m) => m.user_id))
  const orphanUsers = profiles
    .filter((p) => !usersWithSpace.has(p.id))
    .map((p) => ({ id: p.id, name: p.display_name ?? '（未命名）' }))
  const spacesWithSettings = new Set((settingsData ?? []).map((r) => r.space_id))
  const orphanSpaces = liveSpaces
    .filter((s) => !spacesWithSettings.has(s.id))
    .map((s) => ({ id: s.id, name: s.name }))

  const th = { padding: 'var(--sr-space-2)', textAlign: 'left' as const }
  const td = { padding: 'var(--sr-space-2)' }

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: 'var(--sr-space-6) var(--sr-space-4)' }}>
      <p className="sr-muted">
        <Link href={ADMIN_BASE} className="sr-link">
          ← 管理後台
        </Link>
      </p>
      <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>Space／使用者</h1>
      <p className="sr-muted">
        {liveSpaces.length} 個使用中空間、{deletedSpaces.length} 個待清除、{profiles.length} 位使用者。
      </p>

      <section className="sr-card" style={{ marginTop: 'var(--sr-space-4)' }}>
        <h2 className="sr-section-title">佈建／孤兒修復</h2>
        <OrphanRepair users={orphanUsers} spaces={orphanSpaces} />
      </section>

      <section className="sr-card" style={{ marginTop: 'var(--sr-space-4)' }}>
        <h2 className="sr-section-title">空間</h2>
        <div style={{ overflowX: 'auto' }}>
          <table className="sr-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--sr-text-sm)' }}>
            <thead>
              <tr>
                <th style={th}>名稱</th>
                <th style={th}>擁有者</th>
                <th style={th}>隱私</th>
                <th style={{ ...th, textAlign: 'right' }}>成員</th>
                <th style={th}>建立</th>
                <th style={th}>狀態</th>
              </tr>
            </thead>
            <tbody>
              {spaces.map((s) => (
                <tr key={s.id} style={{ borderTop: '1px solid var(--sr-border)', opacity: s.deleted_at ? 0.5 : 1 }}>
                  <td style={td}>
                    <Link href={`${ADMIN_BASE}/spaces/${s.id}`} className="sr-link">
                      {s.name}
                    </Link>
                    <span className="sr-muted" style={{ fontSize: 'var(--sr-text-xs)', display: 'block' }}>
                      /{s.slug}
                    </span>
                  </td>
                  <td style={td}>{nameOf.get(s.owner_id) ?? '—'}</td>
                  <td style={td}>{s.privacy}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{memberCount.get(s.id) ?? 0}</td>
                  <td className="sr-muted" style={td}>{new Date(s.created_at).toLocaleDateString('zh-TW')}</td>
                  <td style={td}>{s.deleted_at ? '待清除' : '使用中'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="sr-card" style={{ marginTop: 'var(--sr-space-4)' }}>
        <h2 className="sr-section-title">使用者</h2>
        <div style={{ overflowX: 'auto' }}>
          <table className="sr-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--sr-text-sm)' }}>
            <thead>
              <tr>
                <th style={th}>名稱</th>
                <th style={th}>登入方式</th>
                <th style={th}>語系</th>
                <th style={th}>加入</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id} style={{ borderTop: '1px solid var(--sr-border)' }}>
                  <td style={td}>
                    {p.display_name ?? '（未命名）'}
                    <span className="sr-muted" style={{ fontSize: 'var(--sr-text-xs)', display: 'block' }}>
                      {p.id.slice(0, 8)}…
                    </span>
                  </td>
                  <td style={td}>{(identOf.get(p.id) ?? ['email']).join('、')}</td>
                  <td style={td}>{p.locale}</td>
                  <td className="sr-muted" style={td}>{new Date(p.created_at).toLocaleDateString('zh-TW')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="sr-muted" style={{ marginTop: 'var(--sr-space-3)', marginBottom: 0, fontSize: 'var(--sr-text-sm)' }}>
          刪除/停用不在此操作 —— 走使用者自己的資料權流程（設定 → 危險區）。以會員 UUID 記身分。
        </p>
      </section>
    </main>
  )
}
