import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { ADMIN_BASE } from '@/lib/admin-path'
import { createAdminClient } from '@snowrealm/db/server'

export const metadata: Metadata = { title: '稽核日誌 — SnowRealm' }
export const dynamic = 'force-dynamic'

type AuditRow = {
  id: string
  action: string
  actor_type: string
  entity_type: string | null
  space_id: string | null
  created_at: string
}

export default async function AdminAuditPage() {
  const gate = await checkSiteAdmin()
  if (!gate.ok) redirect(gate.reason === 'unauthenticated' ? `/login?next=${ADMIN_BASE}/audit` : '/home')

  const admin = createAdminClient()
  const { data } = await admin
    .from('audit_logs')
    .select('id, action, actor_type, entity_type, space_id, created_at')
    .order('created_at', { ascending: false })
    .limit(200)
  const rows = (data ?? []) as AuditRow[]

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: 'var(--sr-space-6) var(--sr-space-4)' }}>
      <p className="sr-muted">
        <Link href={ADMIN_BASE} className="sr-link">
          ← 管理後台
        </Link>
      </p>
      <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>稽核日誌</h1>
      <p className="sr-muted">最近 200 筆「誰改了什麼」。IP 以雜湊儲存，這裡不顯示。</p>

      <section className="sr-card">
        {rows.length === 0 ? (
          <p className="sr-muted" style={{ margin: 0 }}>
            還沒有稽核紀錄。
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="sr-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>時間</th>
                  <th style={{ textAlign: 'left' }}>動作</th>
                  <th style={{ textAlign: 'left' }}>對象</th>
                  <th style={{ textAlign: 'left' }}>執行者</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)', whiteSpace: 'nowrap' }}>
                      {new Date(r.created_at).toLocaleString('zh-TW')}
                    </td>
                    <td>
                      <code>{r.action}</code>
                    </td>
                    <td className="sr-muted">{r.entity_type ?? '—'}</td>
                    <td className="sr-muted">{r.actor_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
