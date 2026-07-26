import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { ADMIN_BASE } from '@/lib/admin-path'
import { SecretGen } from './SecretGen'

export const metadata: Metadata = { title: 'Secret 產生器 — SnowRealm' }
export const dynamic = 'force-dynamic'

export default async function AdminSecretsPage() {
  const gate = await checkSiteAdmin()
  if (!gate.ok) redirect(gate.reason === 'unauthenticated' ? `/login?next=${ADMIN_BASE}/secrets` : '/home')

  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: 'var(--sr-space-6) var(--sr-space-4)' }}>
      <p className="sr-muted">
        <Link href={ADMIN_BASE} className="sr-link">
          ← 管理後台
        </Link>
      </p>
      <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>Secret 產生器</h1>
      <p className="sr-muted">
        產生密碼學等級的隨機值（前端 crypto，產生本身不經伺服器）。選長度與字元組合，產生後複製貼到
        Zeabur env 或後台設定。也可以加密儲存紀錄（值以 AES-256-GCM 加密後才進 DB）。
      </p>
      <SecretGen />
    </main>
  )
}
