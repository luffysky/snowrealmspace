import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { ADMIN_BASE } from '@/lib/admin-path'
import { createAdminClient } from '@snowrealm/db/server'
import { resolveAvatarUrls } from '@/lib/avatar'
import { Avatar } from '@/components/Avatar'

export const metadata: Metadata = { title: '對話紀錄 — SnowRealm' }
export const dynamic = 'force-dynamic'

type Thread = {
  id: string
  space_id: string
  created_by: string | null
  title: string | null
  mode: string
  last_message_at: string
}

/**
 * 對話紀錄（平台維護）：跨空間的 Agent（AI）對話串。唯讀、site-admin only。
 *
 * 說明：本產品是私人空間，**沒有人與人之間的訊息**，所以只有「對 AI」的對話。
 * 存取私人內容有稽核性考量——開啟單一對話會寫 audit_logs。
 */
export default async function AdminConversationsPage() {
  const gate = await checkSiteAdmin()
  if (!gate.ok) redirect(gate.reason === 'unauthenticated' ? `/login?next=${ADMIN_BASE}/conversations` : '/home')

  const admin = createAdminClient()
  const [{ data: threadData }, { data: msgData }, { data: spaceData }, { data: profileData }] = await Promise.all([
    admin
      .from('agent_threads')
      .select('id, space_id, created_by, title, mode, last_message_at')
      .is('deleted_at', null)
      .order('last_message_at', { ascending: false })
      .limit(200),
    admin.from('agent_messages').select('thread_id').limit(20000),
    admin.from('spaces').select('id, name').limit(500),
    admin.from('profiles').select('id, display_name, avatar_asset_id').limit(500),
  ])

  const threads = (threadData ?? []) as Thread[]
  const msgCount = new Map<string, number>()
  for (const m of msgData ?? []) msgCount.set(m.thread_id, (msgCount.get(m.thread_id) ?? 0) + 1)
  const spaceName = new Map((spaceData ?? []).map((s) => [s.id, s.name]))
  const userName = new Map((profileData ?? []).map((p) => [p.id, p.display_name]))
  const avatarAssetOf = new Map(
    (profileData ?? []).map((p) => [p.id, (p as { avatar_asset_id?: string | null }).avatar_asset_id ?? null]),
  )
  const avatarUrls = await resolveAvatarUrls(admin, [...avatarAssetOf.values()])
  const avatarOf = (userId: string): string | null => {
    const aid = avatarAssetOf.get(userId)
    return aid ? (avatarUrls.get(aid) ?? null) : null
  }

  const th = { padding: 'var(--sr-space-2)', textAlign: 'left' as const }
  const td = { padding: 'var(--sr-space-2)' }

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: 'var(--sr-space-6) var(--sr-space-4)' }}>
      <p className="sr-muted">
        <Link href={ADMIN_BASE} className="sr-link">← 管理後台</Link>
      </p>
      <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>對話紀錄</h1>
      <p className="sr-muted">
        跨空間的 AI 對話串（{threads.length}，顯示最近 200）。本產品沒有人對人的訊息，只有對 AI。
        唯讀，開啟單一對話會記入稽核。
      </p>

      {threads.length === 0 ? (
        <p className="sr-muted" style={{ marginTop: 'var(--sr-space-4)' }}>還沒有任何對話。</p>
      ) : (
        <section className="sr-card" style={{ marginTop: 'var(--sr-space-4)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="sr-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--sr-text-sm)' }}>
              <thead>
                <tr>
                  <th style={th}>標題</th>
                  <th style={th}>空間</th>
                  <th style={th}>發起人</th>
                  <th style={{ ...th, textAlign: 'right' }}>訊息</th>
                  <th style={th}>最後更新</th>
                </tr>
              </thead>
              <tbody>
                {threads.map((t) => (
                  <tr key={t.id} style={{ borderTop: '1px solid var(--sr-border)' }}>
                    <td style={td}>
                      <Link href={`${ADMIN_BASE}/conversations/${t.id}`} className="sr-link">
                        {t.title || '（未命名對話）'}
                      </Link>
                      <span className="sr-muted" style={{ fontSize: 'var(--sr-text-xs)', display: 'block' }}>{t.mode}</span>
                    </td>
                    <td style={td}>
                      <Link href={`${ADMIN_BASE}/spaces/${t.space_id}`} className="sr-link">
                        {spaceName.get(t.space_id) ?? t.space_id.slice(0, 8) + '…'}
                      </Link>
                    </td>
                    <td style={td}>
                      {t.created_by ? (
                        <div className="sr-row" style={{ gap: 'var(--sr-space-2)', alignItems: 'center' }}>
                          <Avatar src={avatarOf(t.created_by)} name={userName.get(t.created_by) ?? ''} size={26} />
                          <Link href={`${ADMIN_BASE}/users/${t.created_by}`} className="sr-link">
                            {userName.get(t.created_by) ?? t.created_by.slice(0, 8) + '…'}
                          </Link>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>{msgCount.get(t.id) ?? 0}</td>
                    <td className="sr-muted" style={td}>{new Date(t.last_message_at).toLocaleString('zh-TW')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  )
}
