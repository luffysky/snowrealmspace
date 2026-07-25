import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { ADMIN_BASE } from '@/lib/admin-path'
import { createAdminClient } from '@snowrealm/db/server'

export const metadata: Metadata = { title: '空間詳情 — SnowRealm' }
export const dynamic = 'force-dynamic'

const ROLE_LABEL: Record<string, string> = { owner: '擁有者', collaborator: '協作者', guest: '訪客' }

function fmtBytes(n: number): string {
  if (n <= 0) return '0'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${u[i]}`
}

/**
 * 空間 360 檢視（CRM/ERP）：資訊、成員、資源與成本、近期活動。全真實聚合。
 */
export default async function SpaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const gate = await checkSiteAdmin()
  if (!gate.ok) redirect(gate.reason === 'unauthenticated' ? `/login?next=${ADMIN_BASE}/spaces` : '/home')
  const { id } = await params

  const admin = createAdminClient()
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString()
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date())

  const [{ data: space }, { data: members }, { data: assets }, { data: usage }, { data: quota }, { data: recent }, activityCount] =
    await Promise.all([
      admin.from('spaces').select('id, name, slug, owner_id, privacy, timezone, created_at, deleted_at').eq('id', id).maybeSingle(),
      admin.from('space_members').select('user_id, role, joined_at').eq('space_id', id),
      admin.from('assets').select('bytes').eq('space_id', id).eq('status', 'ready').is('deleted_at', null).limit(20000),
      admin.from('ai_usage_log').select('cost_usd, is_free').eq('space_id', id).gte('created_at', monthAgo).limit(20000),
      admin.from('ai_daily_quota').select('free_calls, paid_calls').eq('space_id', id).eq('local_date', today).maybeSingle(),
      admin.from('activity_events').select('event_type, occurred_at').eq('space_id', id).order('occurred_at', { ascending: false }).limit(20),
      admin.from('activity_events').select('*', { count: 'exact', head: true }).eq('space_id', id),
    ])

  if (!space) {
    return (
      <main style={{ maxWidth: 820, margin: '0 auto', padding: 'var(--sr-space-6) var(--sr-space-4)' }}>
        <p className="sr-muted"><Link href={`${ADMIN_BASE}/spaces`} className="sr-link">← Space／使用者</Link></p>
        <p className="sr-muted">找不到這個空間。</p>
      </main>
    )
  }

  const memberIds = (members ?? []).map((m) => m.user_id)
  const { data: profiles } = memberIds.length
    ? await admin.from('profiles').select('id, display_name').in('id', memberIds)
    : { data: [] }
  const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.display_name]))

  const bytes = (assets ?? []).reduce((s, r) => s + Number(r.bytes ?? 0), 0)
  const aiCost = (usage ?? []).reduce((s, r) => s + Number(r.cost_usd ?? 0), 0)
  const todayCalls = Number(quota?.free_calls ?? 0) + Number(quota?.paid_calls ?? 0)

  const td = { padding: 'var(--sr-space-2)' }

  const stats = [
    { label: '成員', value: String((members ?? []).length) },
    { label: '儲存', value: fmtBytes(bytes), hint: `${(assets ?? []).length} 檔` },
    { label: 'AI 呼叫(30天)', value: String((usage ?? []).length) },
    { label: 'AI 成本(30天)', value: `$${aiCost.toFixed(aiCost < 1 ? 4 : 2)}` },
    { label: '今日呼叫', value: String(todayCalls) },
    { label: '活動', value: String(activityCount.count ?? 0) },
  ]

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 'var(--sr-space-6) var(--sr-space-4)' }}>
      <p className="sr-muted"><Link href={`${ADMIN_BASE}/spaces`} className="sr-link">← Space／使用者</Link></p>
      <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>{space.name}</h1>
      <p className="sr-muted">/{space.slug}{space.deleted_at ? '（待清除）' : ''}</p>

      <section className="sr-card" style={{ marginTop: 'var(--sr-space-4)' }}>
        <h2 className="sr-section-title">資訊</h2>
        <div className="sr-stack" style={{ gap: 'var(--sr-space-1)', fontSize: 'var(--sr-text-sm)' }}>
          <div><span className="sr-muted">空間 ID：</span><code>{space.id}</code></div>
          <div><span className="sr-muted">擁有者：</span>
            <Link href={`${ADMIN_BASE}/users/${space.owner_id}`} className="sr-link">
              {nameOf.get(space.owner_id) ?? space.owner_id.slice(0, 8) + '…'}
            </Link>
          </div>
          <div><span className="sr-muted">隱私：</span>{space.privacy}</div>
          <div><span className="sr-muted">時區：</span>{space.timezone}</div>
          <div><span className="sr-muted">建立：</span>{new Date(space.created_at).toLocaleString('zh-TW')}</div>
        </div>
      </section>

      <section className="sr-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--sr-space-3)', marginTop: 'var(--sr-space-4)' }}>
        {stats.map((s) => (
          <div key={s.label} className="sr-card" style={{ padding: 'var(--sr-space-4)' }}>
            <div className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)' }}>{s.label}</div>
            <div style={{ fontSize: 'var(--sr-text-h2)', fontWeight: 700 }}>{s.value}</div>
            {s.hint && <div className="sr-muted" style={{ fontSize: 'var(--sr-text-xs)' }}>{s.hint}</div>}
          </div>
        ))}
      </section>

      <section className="sr-card" style={{ marginTop: 'var(--sr-space-4)' }}>
        <h2 className="sr-section-title">成員（{(members ?? []).length}）</h2>
        <div style={{ overflowX: 'auto' }}>
          <table className="sr-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--sr-text-sm)' }}>
            <thead>
              <tr style={{ textAlign: 'left' }}>
                <th style={td}>成員</th>
                <th style={td}>角色</th>
                <th style={td}>加入</th>
              </tr>
            </thead>
            <tbody>
              {(members ?? []).map((m) => (
                <tr key={m.user_id} style={{ borderTop: '1px solid var(--sr-border)' }}>
                  <td style={td}>
                    <Link href={`${ADMIN_BASE}/users/${m.user_id}`} className="sr-link">
                      {nameOf.get(m.user_id) ?? m.user_id.slice(0, 8) + '…'}
                    </Link>
                  </td>
                  <td style={td}>{ROLE_LABEL[m.role] ?? m.role}</td>
                  <td className="sr-muted" style={td}>{new Date(m.joined_at).toLocaleDateString('zh-TW')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="sr-card" style={{ marginTop: 'var(--sr-space-4)' }}>
        <h2 className="sr-section-title">近期活動 <span className="sr-muted" style={{ fontWeight: 400 }}>（顯示最近 20）</span></h2>
        {(recent ?? []).length === 0 ? (
          <p className="sr-muted" style={{ margin: 0 }}>還沒有活動。</p>
        ) : (
          <ul className="sr-stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: '2px', fontSize: 'var(--sr-text-sm)' }}>
            {(recent ?? []).map((e, i) => (
              <li key={i} className="sr-row" style={{ justifyContent: 'space-between', gap: 'var(--sr-space-3)' }}>
                <code style={{ fontSize: 'var(--sr-text-xs)' }}>{e.event_type}</code>
                <span className="sr-muted" style={{ fontSize: 'var(--sr-text-xs)' }}>{new Date(e.occurred_at).toLocaleString('zh-TW')}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
