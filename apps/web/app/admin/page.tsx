import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { checkSiteAdmin } from '@/lib/auth/site-admin'

export const metadata: Metadata = { title: '管理後台 — SnowRealm' }
export const dynamic = 'force-dynamic'

const SECTIONS: { group: string; items: { href: string; label: string; desc: string }[] }[] = [
  {
    group: 'AI',
    items: [
      { href: '/admin/ai-keys', label: 'AI 金鑰', desc: '各家 provider 金鑰（加密存 DB）' },
      { href: '/admin/ai/models', label: 'AI 模型', desc: '啟用/免費/串流·工具·視覺標記' },
      { href: '/admin/ai/usage', label: 'AI 用量與成本', desc: '免費vs付費、升級/fallback/cache 率' },
    ],
  },
  {
    group: '系統與稽核',
    items: [
      { href: '/admin/system', label: '系統健康', desc: 'job 佇列、卡住的工作、儲存用量' },
      { href: '/admin/audit', label: '稽核日誌', desc: '誰改了什麼（audit_logs）' },
    ],
  },
]

export default async function AdminHome() {
  const gate = await checkSiteAdmin()
  if (!gate.ok) redirect(gate.reason === 'unauthenticated' ? '/login?next=/admin' : '/home')

  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: 'var(--sr-space-6) var(--sr-space-4)' }}>
      <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>管理後台</h1>
      <p className="sr-muted">站台管理員專用。</p>

      {SECTIONS.map((s) => (
        <section key={s.group} className="sr-card" style={{ marginTop: 'var(--sr-space-4)' }}>
          <h2 className="sr-section-title">{s.group}</h2>
          <ul className="sr-stack" style={{ listStyle: 'none', padding: 0, margin: 0, gap: 'var(--sr-space-2)' }}>
            {s.items.map((it) => (
              <li key={it.href}>
                <Link href={it.href} className="sr-link">
                  {it.label}
                </Link>
                <span className="sr-muted"> — {it.desc}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className="sr-muted" style={{ marginTop: 'var(--sr-space-4)' }}>
        規劃中：候選鏈管理、每日額度、回應快取、內容池、Feature flags、Agent 動作、Space/使用者管理。
      </p>
    </main>
  )
}
