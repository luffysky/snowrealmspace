import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { ADMIN_BASE } from '@/lib/admin-path'
import { FontsAdmin } from './FontsAdmin'

export const metadata: Metadata = { title: '字體管理 — SnowRealm' }
export const dynamic = 'force-dynamic'

export default async function AdminFontsPage() {
  const gate = await checkSiteAdmin()
  if (!gate.ok) redirect(gate.reason === 'unauthenticated' ? `/login?next=${ADMIN_BASE}/fonts` : '/home')

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: 'var(--sr-space-6) var(--sr-space-4)' }}>
      <p className="sr-muted">
        <Link href={ADMIN_BASE} className="sr-link">
          ← 管理後台
        </Link>
      </p>
      <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>字體管理</h1>
      <p className="sr-muted">
        安裝、啟用/停用、移除字體。字體是全域參考資料（非某個 space 的內容）；上傳的原始檔會即時子集化成
        unicode-range 分片並存到 R2，前台字體選單會即時反映。
      </p>
      <FontsAdmin />
    </main>
  )
}
