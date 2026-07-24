import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { createAdminClient } from '@snowrealm/db/server'

export const metadata: Metadata = { title: '每日額度 — SnowRealm' }
export const dynamic = 'force-dynamic'

type Row = {
  space_id: string
  local_date: string
  free_calls: number
  paid_calls: number
  vision_calls: number
}

/**
 * 每日額度（ai_daily_quota）：各 space 當日 AI 呼叫計數（免費/付費/視覺）。
 * 唯讀。付費呼叫爆量時可以在這裡先看到。
 */
export default async function AdminQuotaPage() {
  const gate = await checkSiteAdmin()
  if (!gate.ok) redirect(gate.reason === 'unauthenticated' ? '/login?next=/admin/ai/quota' : '/home')

  const admin = createAdminClient()
  const { data } = await admin
    .from('ai_daily_quota')
    .select('space_id, local_date, free_calls, paid_calls, vision_calls')
    .order('local_date', { ascending: false })
    .limit(200)
  const rows = (data ?? []) as Row[]

  const todayPaid = rows.filter((r) => r.paid_calls > 0)

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 'var(--sr-space-6) var(--sr-space-4)' }}>
      <p className="sr-muted">
        <Link href="/admin" className="sr-link">
          ← 管理後台
        </Link>
      </p>
      <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>每日額度</h1>
      <p className="sr-muted">各空間每日 AI 呼叫計數。付費呼叫（{todayPaid.length} 筆有值）值得留意。</p>

      {rows.length === 0 ? (
        <p className="sr-muted">尚無任何 AI 呼叫紀錄。</p>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: 'var(--sr-space-4)' }}>
          <table className="sr-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--sr-text-sm)' }}>
            <thead>
              <tr style={{ textAlign: 'left' }}>
                <th style={{ padding: 'var(--sr-space-2)' }}>日期</th>
                <th style={{ padding: 'var(--sr-space-2)' }}>Space</th>
                <th style={{ padding: 'var(--sr-space-2)', textAlign: 'right' }}>免費</th>
                <th style={{ padding: 'var(--sr-space-2)', textAlign: 'right' }}>付費</th>
                <th style={{ padding: 'var(--sr-space-2)', textAlign: 'right' }}>視覺</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.space_id}-${r.local_date}`} style={{ borderTop: '1px solid var(--sr-border)' }}>
                  <td style={{ padding: 'var(--sr-space-2)' }}>{r.local_date}</td>
                  <td style={{ padding: 'var(--sr-space-2)' }}>
                    <code style={{ fontSize: 'var(--sr-text-xs)' }}>{r.space_id.slice(0, 8)}…</code>
                  </td>
                  <td style={{ padding: 'var(--sr-space-2)', textAlign: 'right' }}>{r.free_calls}</td>
                  <td style={{ padding: 'var(--sr-space-2)', textAlign: 'right', fontWeight: r.paid_calls > 0 ? 600 : 400 }}>
                    {r.paid_calls}
                  </td>
                  <td style={{ padding: 'var(--sr-space-2)', textAlign: 'right' }}>{r.vision_calls}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
