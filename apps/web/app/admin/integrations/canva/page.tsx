import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { ADMIN_BASE } from '@/lib/admin-path'
import { CANVA_SCOPES, canvaConfig, canvaRedirectUri } from '@/lib/integrations/canva'
import { CanvaConverter } from './CanvaConverter'

export const metadata: Metadata = { title: 'Canva Token 轉換器 — SnowRealm' }
export const dynamic = 'force-dynamic'

/**
 * Canva OAuth Token 轉換器（站台管理員限定）。
 * 產生授權連結 → 在 Canva 同意 → 把導回的網址貼回來，背景換成 access / refresh token。
 */
export default async function CanvaConverterPage() {
  const gate = await checkSiteAdmin()
  if (!gate.ok) {
    redirect(gate.reason === 'unauthenticated' ? `/login?next=${ADMIN_BASE}/integrations/canva` : '/home')
  }

  const configured = Boolean(canvaConfig())

  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: 'var(--sr-space-6) var(--sr-space-4)' }}>
      <p className="sr-muted">
        <Link href={`${ADMIN_BASE}/integrations`} className="sr-link">
          ← 整合狀態
        </Link>
      </p>
      <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>Canva Token 轉換器</h1>
      <p className="sr-muted">
        產生授權連結 → 在 Canva 按同意 → 把導回的網址整條貼回來，背景幫你換成 access / refresh token。
        全程站台管理員限定，token 只顯示給你，不外流。
      </p>

      <CanvaConverter configured={configured} redirectUri={canvaRedirectUri()} scopes={[...CANVA_SCOPES]} />
    </main>
  )
}
