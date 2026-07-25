import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { ADMIN_BASE } from '@/lib/admin-path'
import { createAdminClient } from '@snowrealm/db/server'
import { ContentAdmin, type ContentRow } from './ContentAdmin'

export const metadata: Metadata = { title: '內容池 — SnowRealm' }
export const dynamic = 'force-dynamic'

/**
 * 內容池（content_items）：主動訊息／每日一句／驚喜等文案來源。
 * 完整 CRUD：新增、編輯（文字/權重）、啟用停用、刪除。生日鏈是系統內容，不給刪。
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
    .limit(1000)
  const rows = (data ?? []) as ContentRow[]

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 'var(--sr-space-6) var(--sr-space-4)' }}>
      <p className="sr-muted">
        <Link href={ADMIN_BASE} className="sr-link">
          ← 管理後台
        </Link>
      </p>
      <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>內容池</h1>
      <p className="sr-muted">主動訊息／每日一句／驚喜的文案來源，共 {rows.length} 則。所有輸出仍會過安全過濾。</p>

      <ContentAdmin initial={rows} />
    </main>
  )
}
