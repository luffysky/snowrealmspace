import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { ADMIN_BASE } from '@/lib/admin-path'
import { createAdminClient } from '@snowrealm/db/server'
import { ChainAdmin, type ChainRow } from './ChainAdmin'

export const metadata: Metadata = { title: '生日鏈 — SnowRealm' }
export const dynamic = 'force-dynamic'

/**
 * 生日鏈編輯：全站共用範本，依條件逐步解鎖。內文可用 {name} 代入開啟者名字。
 * 完整 CRUD（新增/改/刪/排序里程碑），走 /api/admin/chain。
 */
export default async function AdminChainPage() {
  const gate = await checkSiteAdmin()
  if (!gate.ok) redirect(gate.reason === 'unauthenticated' ? `/login?next=${ADMIN_BASE}/chain` : '/home')

  const admin = createAdminClient()
  const { data } = await admin
    .from('content_items')
    .select('content_id, label, text, chain_index, available_from, enabled')
    .eq('kind', 'chain')
    .order('chain_index', { ascending: true })
  const rows = (data ?? []) as ChainRow[]

  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: 'var(--sr-space-6) var(--sr-space-4)' }}>
      <p className="sr-muted">
        <Link href={`${ADMIN_BASE}/content`} className="sr-link">
          ← 內容池
        </Link>
      </p>
      <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>生日鏈</h1>
      <p className="sr-muted">
        全站共用一份，依條件逐步解鎖。內文可用 <code>{'{name}'}</code> 代入開啟者的名字。
      </p>
      <ChainAdmin initial={rows} />
    </main>
  )
}
