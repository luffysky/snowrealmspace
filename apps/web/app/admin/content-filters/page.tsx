import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { FORBIDDEN_PATTERNS } from '@snowrealm/validation'
import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { createAdminClient } from '@snowrealm/db/server'
import { ContentFiltersAdmin } from './ContentFiltersAdmin'

export const metadata: Metadata = { title: '內容安全字樣 — SnowRealm' }
export const dynamic = 'force-dynamic'

type Pattern = { id: string; pattern: string; description: string | null; enabled: boolean }

/**
 * 內容安全字樣：底線（程式碼，不可停用）＋ 後台附加（可增刪）。
 * 附加規則只會讓過濾更嚴，永遠無法放寬底線。
 */
export default async function AdminContentFiltersPage() {
  const gate = await checkSiteAdmin()
  if (!gate.ok) redirect(gate.reason === 'unauthenticated' ? '/login?next=/admin/content-filters' : '/home')

  const admin = createAdminClient()
  const { data } = await admin
    .from('content_filter_patterns')
    .select('id, pattern, description, enabled')
    .order('created_at', { ascending: true })
  const rows = (data ?? []) as Pattern[]

  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: 'var(--sr-space-6) var(--sr-space-4)' }}>
      <p className="sr-muted">
        <Link href="/admin" className="sr-link">
          ← 管理後台
        </Link>
      </p>
      <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>內容安全字樣</h1>
      <p className="sr-muted">
        任何內容（AI 生成、人寫、代寫）寫入前都要過這關。底線寫在程式碼、不可停用；
        下面可再附加規則（只會更嚴）。
      </p>

      <section className="sr-card" style={{ padding: 'var(--sr-space-4)', marginTop: 'var(--sr-space-4)' }}>
        <h2 className="sr-section-title">底線（不可編輯，{FORBIDDEN_PATTERNS.length} 條）</h2>
        <ul className="sr-stack" style={{ listStyle: 'none', margin: 'var(--sr-space-2) 0 0', padding: 0, gap: '2px' }}>
          {FORBIDDEN_PATTERNS.map((re) => (
            <li key={re.source}>
              <code style={{ fontSize: 'var(--sr-text-xs)', wordBreak: 'break-all' }}>/{re.source}/</code>
            </li>
          ))}
        </ul>
      </section>

      <ContentFiltersAdmin initial={rows} />
    </main>
  )
}
