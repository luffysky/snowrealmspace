import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { ADMIN_BASE } from '@/lib/admin-path'
import { createAdminClient } from '@snowrealm/db/server'
import { resolveAvatarUrl } from '@/lib/avatar'
import { Avatar } from '@/components/Avatar'
import { UserAdminControls } from './UserAdminControls'
import { UserNotes, type Note } from './UserNotes'
import { isOnline, humanDuration, relativeTime, formatRegion, formatDevice } from '@/lib/analytics/format'

export const metadata: Metadata = { title: '使用者詳情 — SnowRealm' }
export const dynamic = 'force-dynamic'

const ROLE_LABEL: Record<string, string> = { owner: '擁有者', admin: '管理員', member: '成員', collaborator: '協作者', guest: '訪客' }

/**
 * 使用者 360 檢視（CRM）：身分、角色/特權、所屬空間、登入方式、近期活動。
 * 資料全部真實聚合。AI 用量是 per-space 記帳，這裡列出所屬空間供 ERP 層深入。
 */
export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const gate = await checkSiteAdmin()
  if (!gate.ok) redirect(gate.reason === 'unauthenticated' ? `/login?next=${ADMIN_BASE}/users` : '/home')
  const { id } = await params

  const admin = createAdminClient()
  const [{ data: authRes }, { data: profile }, { data: memberships }, { data: identities }, { data: recent }, activityCount] =
    await Promise.all([
      admin.auth.admin.getUserById(id),
      admin.from('profiles').select('display_name, locale, timezone, site_role, privileged, created_at, avatar_asset_id').eq('id', id).maybeSingle(),
      admin.from('space_members').select('space_id, role, joined_at').eq('user_id', id),
      admin.from('user_identities').select('provider, email').eq('user_id', id),
      admin.from('activity_events').select('event_type, occurred_at').eq('actor_id', id).order('occurred_at', { ascending: false }).limit(20),
      admin.from('activity_events').select('*', { count: 'exact', head: true }).eq('actor_id', id),
    ])

  const { data: noteData } = await admin
    .from('admin_user_notes')
    .select('id, body, author_id, created_at')
    .eq('subject_user_id', id)
    .order('created_at', { ascending: false })
    .limit(100)
  const notes = (noteData ?? []) as Note[]

  // 上線資訊：最近 5 個工作階段（新到舊）。第一筆＝最新，供上方摘要。
  const { data: sessionData } = await admin
    .from('user_sessions')
    .select('id, started_at, last_seen_at, total_duration_sec, country, region, city, device_type, browser, os, page_count')
    .eq('user_id', id)
    .order('last_seen_at', { ascending: false })
    .limit(5)
  const sessions = sessionData ?? []
  const latestSession = sessions[0] ?? null

  const authUser = authRes?.user ?? null
  if (!authUser && !profile) {
    return (
      <main style={{ maxWidth: 820, margin: '0 auto', padding: 'var(--sr-space-6) var(--sr-space-4)' }}>
        <p className="sr-muted">
          <Link href={`${ADMIN_BASE}/users`} className="sr-link">← 使用者管理</Link>
        </p>
        <p className="sr-muted">找不到這位使用者。</p>
      </main>
    )
  }

  const spaceIds = (memberships ?? []).map((m) => m.space_id)
  const { data: spaces } = spaceIds.length
    ? await admin.from('spaces').select('id, name, slug, privacy, created_at, deleted_at').in('id', spaceIds)
    : { data: [] }
  const roleInSpace = new Map((memberships ?? []).map((m) => [m.space_id, m.role]))

  const role = (profile?.site_role === 'owner' || profile?.site_role === 'admin' ? profile.site_role : 'member') as
    | 'owner'
    | 'admin'
    | 'member'
  const email = authUser?.email ?? null
  const username = (authUser?.user_metadata as { username?: string } | null)?.username ?? null
  const lastSignIn = authUser?.last_sign_in_at ?? null
  const avatarSrc = await resolveAvatarUrl(admin, (profile as { avatar_asset_id?: string | null } | null)?.avatar_asset_id ?? null)

  const td = { padding: 'var(--sr-space-2)' }

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 'var(--sr-space-6) var(--sr-space-4)' }}>
      <p className="sr-muted">
        <Link href={`${ADMIN_BASE}/users`} className="sr-link">← 使用者管理</Link>
      </p>
      <div className="sr-row" style={{ gap: 'var(--sr-space-3)', alignItems: 'center' }}>
        <Avatar src={avatarSrc} name={profile?.display_name || username || email || ''} size={52} />
        <div>
          <h1 style={{ fontSize: 'var(--sr-text-h1)', margin: 0 }}>{profile?.display_name || username || email || '使用者'}</h1>
          <p className="sr-muted" style={{ margin: 0 }}>{email}</p>
        </div>
      </div>

      <section className="sr-card" style={{ marginTop: 'var(--sr-space-4)' }}>
        <h2 className="sr-section-title">身分與權限</h2>
        <div className="sr-stack" style={{ gap: 'var(--sr-space-1)', fontSize: 'var(--sr-text-sm)' }}>
          <div><span className="sr-muted">使用者 ID：</span><code>{id}</code></div>
          {username && <div><span className="sr-muted">使用者名稱：</span>{username}</div>}
          <div><span className="sr-muted">語系／時區：</span>{profile?.locale ?? '—'}／{profile?.timezone ?? '—'}</div>
          <div><span className="sr-muted">註冊：</span>{profile?.created_at ? new Date(profile.created_at).toLocaleString('zh-TW') : '—'}</div>
          <div><span className="sr-muted">上次登入：</span>{lastSignIn ? new Date(lastSignIn).toLocaleString('zh-TW') : '—'}</div>
          <div><span className="sr-muted">登入方式：</span>{(identities ?? []).map((i) => i.provider).join('、') || 'email'}</div>
        </div>
        <div style={{ marginTop: 'var(--sr-space-3)', paddingTop: 'var(--sr-space-3)', borderTop: '1px solid var(--sr-border)' }}>
          <UserAdminControls
            userId={id}
            initialRole={role}
            initialPrivileged={Boolean(profile?.privileged)}
            isOwner={gate.role === 'owner'}
            isSelf={id === gate.userId}
          />
        </div>
      </section>

      <section className="sr-card" style={{ marginTop: 'var(--sr-space-4)' }}>
        <h2 className="sr-section-title">
          上線資訊
          {latestSession && isOnline(latestSession.last_seen_at, 5) && (
            <span
              style={{
                marginInlineStart: 'var(--sr-space-2)',
                fontSize: 'var(--sr-text-xs)',
                fontWeight: 400,
                color: 'var(--sr-success)',
              }}
            >
              ● 在線
            </span>
          )}
        </h2>
        {!latestSession ? (
          <p className="sr-muted" style={{ margin: 0 }}>還沒有上線紀錄。</p>
        ) : (
          <>
            <div className="sr-stack" style={{ gap: 'var(--sr-space-1)', fontSize: 'var(--sr-text-sm)', minWidth: 0 }}>
              <div style={{ overflowWrap: 'anywhere' }}>
                <span className="sr-muted">上線時間：</span>
                {new Date(latestSession.started_at).toLocaleString('zh-TW')}
              </div>
              <div><span className="sr-muted">在線時長：</span>{humanDuration(latestSession.total_duration_sec)}</div>
              <div>
                <span className="sr-muted">最後上線：</span>
                {relativeTime(latestSession.last_seen_at)}
                <span className="sr-muted" style={{ fontSize: 'var(--sr-text-xs)' }}>
                  {'　'}（{new Date(latestSession.last_seen_at).toLocaleString('zh-TW')}）
                </span>
              </div>
              <div style={{ overflowWrap: 'anywhere' }}>
                <span className="sr-muted">地區：</span>
                {formatRegion(latestSession.country, latestSession.region, latestSession.city)}
              </div>
              <div style={{ overflowWrap: 'anywhere' }}>
                <span className="sr-muted">裝置：</span>
                {formatDevice(latestSession.device_type, latestSession.browser, latestSession.os)}
              </div>
            </div>

            {sessions.length > 1 && (
              <div style={{ marginTop: 'var(--sr-space-3)', paddingTop: 'var(--sr-space-3)', borderTop: '1px solid var(--sr-border)' }}>
                <p className="sr-muted" style={{ margin: '0 0 var(--sr-space-2)', fontSize: 'var(--sr-text-xs)' }}>
                  近期工作階段（最近 {sessions.length}）
                </p>
                <ul className="sr-stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 'var(--sr-space-1)', fontSize: 'var(--sr-text-xs)' }}>
                  {sessions.map((s) => (
                    <li key={s.id} className="sr-row" style={{ justifyContent: 'space-between', gap: 'var(--sr-space-2)', minWidth: 0 }}>
                      <span className="sr-muted" style={{ flexShrink: 0 }}>
                        {new Date(s.last_seen_at).toLocaleString('zh-TW')}
                      </span>
                      <span style={{ textAlign: 'right', overflowWrap: 'anywhere', minWidth: 0 }}>
                        {formatDevice(s.device_type, s.browser, s.os)}
                        {' · '}
                        {formatRegion(s.country, s.region, s.city)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>

      <section className="sr-card" style={{ marginTop: 'var(--sr-space-4)' }}>
        <h2 className="sr-section-title">內部註記（CRM）</h2>
        <UserNotes subjectUserId={id} initial={notes} />
      </section>

      <section className="sr-card" style={{ marginTop: 'var(--sr-space-4)' }}>
        <h2 className="sr-section-title">所屬空間（{spaces?.length ?? 0}）</h2>
        {(spaces ?? []).length === 0 ? (
          <p className="sr-muted" style={{ margin: 0 }}>沒有任何空間。</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="sr-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--sr-text-sm)' }}>
              <thead>
                <tr style={{ textAlign: 'left' }}>
                  <th style={td}>名稱</th>
                  <th style={td}>角色</th>
                  <th style={td}>隱私</th>
                  <th style={td}>狀態</th>
                </tr>
              </thead>
              <tbody>
                {(spaces ?? []).map((s) => (
                  <tr key={s.id} style={{ borderTop: '1px solid var(--sr-border)', opacity: s.deleted_at ? 0.5 : 1 }}>
                    <td style={td}>
                      {s.name}
                      <span className="sr-muted" style={{ fontSize: 'var(--sr-text-xs)', display: 'block' }}>/{s.slug}</span>
                    </td>
                    <td style={td}>{ROLE_LABEL[roleInSpace.get(s.id) ?? ''] ?? roleInSpace.get(s.id) ?? '—'}</td>
                    <td style={td}>{s.privacy}</td>
                    <td style={td}>{s.deleted_at ? '待清除' : '使用中'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="sr-card" style={{ marginTop: 'var(--sr-space-4)' }}>
        <h2 className="sr-section-title">
          近期活動 <span className="sr-muted" style={{ fontWeight: 400 }}>（共 {activityCount.count ?? 0} 筆，顯示最近 20）</span>
        </h2>
        {(recent ?? []).length === 0 ? (
          <p className="sr-muted" style={{ margin: 0 }}>還沒有活動紀錄。</p>
        ) : (
          <ul className="sr-stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: '2px', fontSize: 'var(--sr-text-sm)' }}>
            {(recent ?? []).map((e, i) => (
              <li key={i} className="sr-row" style={{ justifyContent: 'space-between', gap: 'var(--sr-space-3)' }}>
                <code style={{ fontSize: 'var(--sr-text-xs)' }}>{e.event_type}</code>
                <span className="sr-muted" style={{ fontSize: 'var(--sr-text-xs)' }}>
                  {new Date(e.occurred_at).toLocaleString('zh-TW')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
