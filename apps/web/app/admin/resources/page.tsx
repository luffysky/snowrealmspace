import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { ADMIN_BASE } from '@/lib/admin-path'
import { createAdminClient } from '@snowrealm/db/server'

export const metadata: Metadata = { title: '資源與成本 — SnowRealm' }
export const dynamic = 'force-dynamic'

function fmtBytes(n: number): string {
  if (n <= 0) return '0'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${u[i]}`
}

/**
 * ERP：各空間的資源與成本帳（儲存、AI 呼叫/成本、今日額度）。
 * per-space 記帳的真實聚合（gift 規模，JS 內加總即可）。
 * 之後接 AI Dot / Z幣經濟時，這頁是帳本入口。
 */
export default async function AdminResourcesPage() {
  const gate = await checkSiteAdmin()
  if (!gate.ok) redirect(gate.reason === 'unauthenticated' ? `/login?next=${ADMIN_BASE}/resources` : '/home')

  const admin = createAdminClient()
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString()
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date())

  const [{ data: spaces }, { data: assets }, { data: usage }, { data: quota }] = await Promise.all([
    admin.from('spaces').select('id, name, slug').is('deleted_at', null).limit(500),
    admin.from('assets').select('space_id, bytes').eq('status', 'ready').is('deleted_at', null).limit(20000),
    admin.from('ai_usage_log').select('space_id, cost_usd, is_free').gte('created_at', monthAgo).limit(20000),
    admin.from('ai_daily_quota').select('space_id, free_calls, paid_calls').eq('local_date', today).limit(2000),
  ])

  type Agg = { bytes: number; files: number; aiCalls: number; aiCost: number; todayCalls: number }
  const map = new Map<string, Agg>()
  const get = (id: string): Agg => {
    let a = map.get(id)
    if (!a) {
      a = { bytes: 0, files: 0, aiCalls: 0, aiCost: 0, todayCalls: 0 }
      map.set(id, a)
    }
    return a
  }
  for (const r of assets ?? []) {
    if (!r.space_id) continue
    const a = get(r.space_id)
    a.bytes += Number(r.bytes ?? 0)
    a.files += 1
  }
  for (const r of usage ?? []) {
    if (!r.space_id) continue
    const a = get(r.space_id)
    a.aiCalls += 1
    a.aiCost += Number(r.cost_usd ?? 0)
  }
  for (const r of quota ?? []) {
    if (!r.space_id) continue
    get(r.space_id).todayCalls += Number(r.free_calls ?? 0) + Number(r.paid_calls ?? 0)
  }

  const rows = (spaces ?? [])
    .map((s) => ({ ...s, ...get(s.id) }))
    .sort((a, b) => b.bytes - a.bytes || b.aiCost - a.aiCost)

  const tot = rows.reduce(
    (t, r) => ({ bytes: t.bytes + r.bytes, files: t.files + r.files, aiCalls: t.aiCalls + r.aiCalls, aiCost: t.aiCost + r.aiCost, todayCalls: t.todayCalls + r.todayCalls }),
    { bytes: 0, files: 0, aiCalls: 0, aiCost: 0, todayCalls: 0 },
  )

  const th = { padding: 'var(--sr-space-2)', textAlign: 'left' as const }
  const td = { padding: 'var(--sr-space-2)' }
  const tdR = { ...td, textAlign: 'right' as const }

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: 'var(--sr-space-6) var(--sr-space-4)' }}>
      <p className="sr-muted">
        <Link href={ADMIN_BASE} className="sr-link">← 管理後台</Link>
      </p>
      <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>資源與成本</h1>
      <p className="sr-muted">
        各空間的儲存與 AI 用量帳（近 30 天）。共 {rows.length} 個空間、儲存 {fmtBytes(tot.bytes)}、
        AI 呼叫 {tot.aiCalls}、成本 ${tot.aiCost.toFixed(tot.aiCost < 1 ? 4 : 2)}。
        AI 相關在貼金鑰前會是 0。
      </p>

      <section className="sr-card" style={{ marginTop: 'var(--sr-space-4)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="sr-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--sr-text-sm)' }}>
            <thead>
              <tr>
                <th style={th}>空間</th>
                <th style={tdR}>儲存</th>
                <th style={tdR}>檔案</th>
                <th style={tdR}>AI 呼叫</th>
                <th style={tdR}>AI 成本</th>
                <th style={tdR}>今日呼叫</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderTop: '1px solid var(--sr-border)' }}>
                  <td style={td}>
                    {r.name}
                    <span className="sr-muted" style={{ fontSize: 'var(--sr-text-xs)', display: 'block' }}>/{r.slug}</span>
                  </td>
                  <td style={tdR}>{fmtBytes(r.bytes)}</td>
                  <td style={tdR}>{r.files}</td>
                  <td style={tdR}>{r.aiCalls}</td>
                  <td style={tdR}>${r.aiCost.toFixed(r.aiCost < 1 ? 4 : 2)}</td>
                  <td style={tdR}>{r.todayCalls}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--sr-border)', fontWeight: 600 }}>
                <td style={td}>合計</td>
                <td style={tdR}>{fmtBytes(tot.bytes)}</td>
                <td style={tdR}>{tot.files}</td>
                <td style={tdR}>{tot.aiCalls}</td>
                <td style={tdR}>${tot.aiCost.toFixed(tot.aiCost < 1 ? 4 : 2)}</td>
                <td style={tdR}>{tot.todayCalls}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <p className="sr-muted" style={{ marginTop: 'var(--sr-space-3)', fontSize: 'var(--sr-text-sm)' }}>
        之後接 AI Dot／Z幣經濟時，這裡會長成完整帳本（發放、扣點、加購、對帳）。
      </p>
    </main>
  )
}
