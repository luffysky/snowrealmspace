import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { ADMIN_BASE } from '@/lib/admin-path'
import { createAdminClient } from '@snowrealm/db/server'

export const metadata: Metadata = { title: '系統健康 — SnowRealm' }
export const dynamic = 'force-dynamic'

type JobRow = { id: string; type: string; status: string; last_error: string | null; started_at: string | null }

export default async function AdminSystemPage() {
  const gate = await checkSiteAdmin()
  if (!gate.ok) redirect(gate.reason === 'unauthenticated' ? `/login?next=${ADMIN_BASE}/system` : '/home')

  const admin = createAdminClient()
  const { data } = await admin
    .from('job_records')
    .select('id, type, status, last_error, started_at')
    .order('started_at', { ascending: false })
    .limit(500)
  const jobs = (data ?? []) as JobRow[]

  const byStatus = new Map<string, number>()
  for (const j of jobs) byStatus.set(j.status, (byStatus.get(j.status) ?? 0) + 1)
  const failures = jobs.filter((j) => j.status === 'failed').slice(0, 20)

  const [{ count: spaces }, { count: assets }] = await Promise.all([
    admin.from('spaces').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    admin.from('assets').select('id', { count: 'exact', head: true }).is('deleted_at', null),
  ])

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 'var(--sr-space-6) var(--sr-space-4)' }}>
      <p className="sr-muted">
        <Link href={ADMIN_BASE} className="sr-link">
          ← 管理後台
        </Link>
      </p>
      <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>系統健康</h1>

      <section className="sr-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--sr-space-3)' }}>
        {[
          { label: '空間', value: String(spaces ?? 0) },
          { label: '檔案', value: String(assets ?? 0) },
          { label: 'Job（排隊）', value: String(byStatus.get('queued') ?? 0) },
          { label: 'Job（執行中）', value: String(byStatus.get('running') ?? 0) },
          { label: 'Job（失敗）', value: String(byStatus.get('failed') ?? 0) },
          { label: 'Job（完成）', value: String(byStatus.get('completed') ?? 0) },
        ].map((s) => (
          <div key={s.label} className="sr-card" style={{ padding: 'var(--sr-space-4)' }}>
            <div className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)' }}>{s.label}</div>
            <div style={{ fontSize: 'var(--sr-text-lg)', fontWeight: 600 }}>{s.value}</div>
          </div>
        ))}
      </section>

      <section className="sr-card" style={{ marginTop: 'var(--sr-space-4)' }}>
        <h2 className="sr-section-title">最近的失敗 job</h2>
        {failures.length === 0 ? (
          <p className="sr-muted" style={{ margin: 0 }}>
            沒有失敗的 job。👍
          </p>
        ) : (
          <ul className="sr-stack" style={{ margin: 0, paddingLeft: 'var(--sr-space-4)' }}>
            {failures.map((j) => (
              <li key={j.id}>
                <code>{j.type}</code>
                <span className="sr-muted"> — {j.last_error ?? '未知錯誤'}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="sr-muted" style={{ marginBottom: 0, marginTop: 'var(--sr-space-3)', fontSize: 'var(--sr-text-sm)' }}>
          Job 靠 worker 執行。若排隊一直不減，多半是 worker 沒在跑。
        </p>
      </section>
    </main>
  )
}
