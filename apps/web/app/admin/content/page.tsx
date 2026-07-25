import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { ADMIN_BASE } from '@/lib/admin-path'
import { createAdminClient } from '@snowrealm/db/server'
import { ContentToggle } from './ContentToggle'

export const metadata: Metadata = { title: '內容池 — SnowRealm' }
export const dynamic = 'force-dynamic'

type Row = {
  content_id: string
  kind: string
  label: string | null
  text: string
  enabled: boolean
  weight: number
  rarity: string | null
  tags: string[]
}

/**
 * 內容池（content_items）：主動訊息／每日一句／驚喜等文案來源。
 * 唯讀。依 kind 分組，看得到啟用狀態與權重。
 */
export default async function AdminContentPage() {
  const gate = await checkSiteAdmin()
  if (!gate.ok) redirect(gate.reason === 'unauthenticated' ? `/login?next=${ADMIN_BASE}/content` : '/home')

  const admin = createAdminClient()
  const { data } = await admin
    .from('content_items')
    .select('content_id, kind, label, text, enabled, weight, rarity, tags')
    .order('kind', { ascending: true })
    .order('weight', { ascending: false })
    .limit(500)
  const rows = (data ?? []) as Row[]

  const byKind = new Map<string, Row[]>()
  for (const r of rows) {
    const list = byKind.get(r.kind) ?? []
    list.push(r)
    byKind.set(r.kind, list)
  }

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 'var(--sr-space-6) var(--sr-space-4)' }}>
      <p className="sr-muted">
        <Link href={ADMIN_BASE} className="sr-link">
          ← 管理後台
        </Link>
      </p>
      <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>內容池</h1>
      <p className="sr-muted">主動訊息／每日一句／驚喜的文案來源，共 {rows.length} 則。所有輸出仍會過安全過濾。</p>

      {rows.length === 0 ? (
        <p className="sr-muted">內容池是空的。</p>
      ) : (
        [...byKind.entries()].map(([kind, list]) => (
          <section key={kind} className="sr-card" style={{ marginTop: 'var(--sr-space-4)' }}>
            <h2 className="sr-section-title">
              {kind} <span className="sr-muted" style={{ fontWeight: 400 }}>（{list.length}）</span>
            </h2>
            <ul className="sr-stack" style={{ margin: 0, padding: 0, listStyle: 'none', gap: 'var(--sr-space-2)' }}>
              {list.map((r) => (
                <li key={r.content_id} style={{ opacity: r.enabled ? 1 : 0.5 }}>
                  <span style={{ fontSize: 'var(--sr-text-sm)' }}>{r.text}</span>
                  <span className="sr-muted" style={{ fontSize: 'var(--sr-text-xs)', marginLeft: 'var(--sr-space-2)' }}>
                    ·權重 {r.weight}
                    {r.rarity ? ` ·${r.rarity}` : ''}
                    {r.tags.length ? ` ·${r.tags.join('/')}` : ''}
                  </span>
                  <ContentToggle contentId={r.content_id} initialEnabled={r.enabled} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </main>
  )
}
