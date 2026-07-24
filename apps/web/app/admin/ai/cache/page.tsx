import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { createAdminClient } from '@snowrealm/db/server'

export const metadata: Metadata = { title: '回應快取 — SnowRealm' }
export const dynamic = 'force-dynamic'

type Row = {
  id: string
  usage_key: string
  scope: string
  hit_count: number
  expires_at: string
  space_id: string | null
  created_at: string
}

/**
 * 回應快取（ai_response_cache）：命中率越高越省成本。
 * 跨 space 永不共用非公開快取（scope=global 才共用）——這裡看得到 scope。
 */
export default async function AdminCachePage() {
  const gate = await checkSiteAdmin()
  if (!gate.ok) redirect(gate.reason === 'unauthenticated' ? '/login?next=/admin/ai/cache' : '/home')

  const admin = createAdminClient()
  const { data } = await admin
    .from('ai_response_cache')
    .select('id, usage_key, scope, hit_count, expires_at, space_id, created_at')
    .order('hit_count', { ascending: false })
    .limit(200)
  const rows = (data ?? []) as Row[]

  const totalHits = rows.reduce((s, r) => s + r.hit_count, 0)
  const now = new Date().toISOString()

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 'var(--sr-space-6) var(--sr-space-4)' }}>
      <p className="sr-muted">
        <Link href="/admin" className="sr-link">
          ← 管理後台
        </Link>
      </p>
      <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>回應快取</h1>
      <p className="sr-muted">
        共 {rows.length} 筆（顯示前 200，依命中排序），累計命中 {totalHits} 次。scope=global 才跨 space 共用。
      </p>

      {rows.length === 0 ? (
        <p className="sr-muted">尚無快取。</p>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: 'var(--sr-space-4)' }}>
          <table className="sr-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--sr-text-sm)' }}>
            <thead>
              <tr style={{ textAlign: 'left' }}>
                <th style={{ padding: 'var(--sr-space-2)' }}>用途</th>
                <th style={{ padding: 'var(--sr-space-2)' }}>範圍</th>
                <th style={{ padding: 'var(--sr-space-2)', textAlign: 'right' }}>命中</th>
                <th style={{ padding: 'var(--sr-space-2)' }}>Space</th>
                <th style={{ padding: 'var(--sr-space-2)' }}>狀態</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderTop: '1px solid var(--sr-border)' }}>
                  <td style={{ padding: 'var(--sr-space-2)' }}>
                    <code style={{ fontSize: 'var(--sr-text-xs)' }}>{r.usage_key}</code>
                  </td>
                  <td style={{ padding: 'var(--sr-space-2)' }}>{r.scope}</td>
                  <td style={{ padding: 'var(--sr-space-2)', textAlign: 'right', fontWeight: 600 }}>{r.hit_count}</td>
                  <td style={{ padding: 'var(--sr-space-2)' }}>
                    {r.space_id ? <code style={{ fontSize: 'var(--sr-text-xs)' }}>{r.space_id.slice(0, 8)}…</code> : '—'}
                  </td>
                  <td className="sr-muted" style={{ padding: 'var(--sr-space-2)' }}>
                    {r.expires_at < now ? '已過期' : '有效'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
