import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { createAdminClient } from '@snowrealm/db/server'

export const metadata: Metadata = { title: 'AI 用量與成本 — SnowRealm' }
export const dynamic = 'force-dynamic'

const SAMPLE = 5000 // 聚合最近這麼多筆（生日禮物規模足夠；量大再改 SQL 聚合）

type Row = {
  cost_usd: number
  is_free: boolean
  provider: string
  model: string
  usage_key: string
  escalated: boolean
  fell_back: boolean
  degraded: boolean
  cache_hit: string | null
  tokens_input: number
  tokens_output: number
  created_at: string
}

function money(n: number): string {
  return `$${n.toFixed(n < 1 ? 4 : 2)}`
}

function tally<T extends string>(rows: Row[], key: (r: Row) => T) {
  const map = new Map<T, { calls: number; cost: number }>()
  for (const r of rows) {
    const k = key(r)
    const cur = map.get(k) ?? { calls: 0, cost: 0 }
    cur.calls += 1
    cur.cost += r.cost_usd
    map.set(k, cur)
  }
  return [...map.entries()].sort((a, b) => b[1].calls - a[1].calls)
}

export default async function AdminAiUsagePage() {
  const gate = await checkSiteAdmin()
  if (!gate.ok) {
    redirect(gate.reason === 'unauthenticated' ? '/login?next=/admin/ai/usage' : '/home')
  }

  const admin = createAdminClient()
  const { data } = await admin
    .from('ai_usage_log')
    .select(
      'cost_usd, is_free, provider, model, usage_key, escalated, fell_back, degraded, cache_hit, tokens_input, tokens_output, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(SAMPLE)

  const rows = (data ?? []) as Row[]
  const total = rows.length
  const totalCost = rows.reduce((s, r) => s + r.cost_usd, 0)
  const freeCalls = rows.filter((r) => r.is_free).length
  const paidCalls = total - freeCalls
  const escalated = rows.filter((r) => r.escalated).length
  const fellBack = rows.filter((r) => r.fell_back).length
  const degraded = rows.filter((r) => r.degraded).length
  const cacheHits = rows.filter((r) => r.cache_hit).length
  const inTok = rows.reduce((s, r) => s + r.tokens_input, 0)
  const outTok = rows.reduce((s, r) => s + r.tokens_output, 0)
  const pct = (n: number) => (total ? `${Math.round((n / total) * 100)}%` : '—')

  const byProvider = tally(rows, (r) => r.provider)
  const byUsage = tally(rows, (r) => r.usage_key)

  const stats: { label: string; value: string; hint?: string }[] = [
    { label: '呼叫數', value: String(total), hint: `最近 ${SAMPLE} 筆內` },
    { label: '總成本', value: money(totalCost), hint: '付費模型累計' },
    { label: '免費 / 付費', value: `${freeCalls} / ${paidCalls}`, hint: `免費 ${pct(freeCalls)}` },
    { label: 'Token（進/出）', value: `${inTok.toLocaleString()} / ${outTok.toLocaleString()}` },
    { label: '升級付費', value: `${escalated}（${pct(escalated)}）`, hint: '免費信心低才升級' },
    { label: 'Fallback', value: `${fellBack}（${pct(fellBack)}）`, hint: '候選失敗換下一個' },
    { label: 'Cache 命中', value: `${cacheHits}（${pct(cacheHits)}）` },
    { label: 'Degraded', value: `${degraded}（${pct(degraded)}）`, hint: '全鏈失敗的誠實降級' },
  ]

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: 'var(--sr-space-6, 32px) var(--sr-space-4, 16px)' }}>
      <h1 style={{ fontSize: 'var(--sr-text-h1, 1.8rem)' }}>AI 用量與成本</h1>
      <p className="sr-muted">
        免費優先的路由跑得如何。聚合最近 {SAMPLE} 筆 <code>ai_usage_log</code>。{' '}
        <Link href="/admin/ai-keys" className="sr-link">
          金鑰管理 →
        </Link>
      </p>

      {total === 0 ? (
        <section className="sr-card">
          <p className="sr-muted" style={{ margin: 0 }}>
            還沒有任何 AI 呼叫紀錄。設好金鑰、在 Agent 對話跑幾次就會出現。
          </p>
        </section>
      ) : (
        <>
          <section className="sr-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--sr-space-3, 12px)' }}>
            {stats.map((s) => (
              <div key={s.label} className="sr-card" style={{ padding: 'var(--sr-space-4, 16px)' }}>
                <div className="sr-muted" style={{ fontSize: 'var(--sr-text-sm, 0.85rem)' }}>{s.label}</div>
                <div style={{ fontSize: 'var(--sr-text-lg, 1.2rem)', fontWeight: 600 }}>{s.value}</div>
                {s.hint && <div className="sr-muted" style={{ fontSize: 'var(--sr-text-sm, 0.8rem)' }}>{s.hint}</div>}
              </div>
            ))}
          </section>

          <Breakdown title="依 Provider" rows={byProvider} total={total} />
          <Breakdown title="依用途（usage key）" rows={byUsage} total={total} />
        </>
      )}
    </main>
  )
}

function Breakdown({
  title,
  rows,
  total,
}: {
  title: string
  rows: [string, { calls: number; cost: number }][]
  total: number
}) {
  return (
    <section className="sr-card" style={{ marginTop: 'var(--sr-space-4, 16px)' }}>
      <h2 className="sr-section-title">{title}</h2>
      <div style={{ overflowX: 'auto' }}>
        <table className="sr-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>名稱</th>
              <th style={{ textAlign: 'right' }}>呼叫</th>
              <th style={{ textAlign: 'right' }}>佔比</th>
              <th style={{ textAlign: 'right' }}>成本</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, v]) => (
              <tr key={name}>
                <td>{name}</td>
                <td style={{ textAlign: 'right' }}>{v.calls}</td>
                <td style={{ textAlign: 'right' }} className="sr-muted">
                  {total ? `${Math.round((v.calls / total) * 100)}%` : '—'}
                </td>
                <td style={{ textAlign: 'right' }}>{money(v.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
