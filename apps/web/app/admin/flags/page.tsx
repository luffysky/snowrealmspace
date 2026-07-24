import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { createAdminClient } from '@snowrealm/db/server'
import { FlagsAdmin } from './FlagsAdmin'

export const metadata: Metadata = { title: 'Feature Flags — SnowRealm' }
export const dynamic = 'force-dynamic'

type Flag = { key: string; description: string | null; enabled: boolean }
type Override = { key: string; space_id: string; enabled: boolean }

/**
 * Feature flags（feature_flags 全域 + space_feature_overrides 每 space 覆寫）。
 * 全域可切換；space 覆寫唯讀顯示（由各 space 或佈建設定）。
 */
export default async function AdminFlagsPage() {
  const gate = await checkSiteAdmin()
  if (!gate.ok) redirect(gate.reason === 'unauthenticated' ? '/login?next=/admin/flags' : '/home')

  const admin = createAdminClient()
  const [{ data: flagData }, { data: ovData }] = await Promise.all([
    admin.from('feature_flags').select('key, description, enabled').order('key', { ascending: true }),
    admin.from('space_feature_overrides').select('key, space_id, enabled').order('key', { ascending: true }).limit(200),
  ])
  const flags = (flagData ?? []) as Flag[]
  const overrides = (ovData ?? []) as Override[]

  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: 'var(--sr-space-6) var(--sr-space-4)' }}>
      <p className="sr-muted">
        <Link href="/admin" className="sr-link">
          ← 管理後台
        </Link>
      </p>
      <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>Feature Flags</h1>
      <p className="sr-muted">全域旗標可即時切換。關閉的功能其路由與 API 都會回 404（不是只藏按鈕）。</p>

      <section style={{ marginTop: 'var(--sr-space-4)' }}>
        <FlagsAdmin initial={flags} />
      </section>

      {overrides.length > 0 && (
        <section className="sr-card" style={{ marginTop: 'var(--sr-space-4)' }}>
          <h2 className="sr-section-title">Space 覆寫（唯讀）</h2>
          <ul className="sr-stack" style={{ margin: 0, paddingLeft: 'var(--sr-space-4)', fontSize: 'var(--sr-text-sm)' }}>
            {overrides.map((o) => (
              <li key={`${o.key}-${o.space_id}`}>
                <code>{o.key}</code>
                <span className="sr-muted">
                  {' '}
                  · {o.space_id.slice(0, 8)}… · {o.enabled ? '開' : '關'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
