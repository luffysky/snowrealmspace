import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { ADMIN_BASE } from '@/lib/admin-path'
import { AiModelsAdmin } from './AiModelsAdmin'

export const metadata: Metadata = { title: 'AI 模型管理 — SnowRealm' }
export const dynamic = 'force-dynamic'

export default async function AdminAiModelsPage() {
  const gate = await checkSiteAdmin()
  if (!gate.ok) redirect(gate.reason === 'unauthenticated' ? `/login?next=${ADMIN_BASE}/ai/models` : '/home')

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: 'var(--sr-space-6) var(--sr-space-4)' }}>
      <p className="sr-muted">
        <Link href={ADMIN_BASE} className="sr-link">
          ← 管理後台
        </Link>
      </p>
      <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>AI 模型管理</h1>
      <p className="sr-muted">切換每個模型的啟用/免費，以及支援串流·工具·視覺的標記（影響路由候選）。</p>
      <AiModelsAdmin />
    </main>
  )
}
