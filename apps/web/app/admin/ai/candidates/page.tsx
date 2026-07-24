import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { createAdminClient } from '@snowrealm/db/server'

export const metadata: Metadata = { title: '候選鏈 — SnowRealm' }
export const dynamic = 'force-dynamic'

type Row = {
  usage_key: string
  model_name: string
  candidates: unknown
  enabled: boolean
  updated_at: string
}

/**
 * 候選鏈（ai_usage_models）：每個用途（usage_key）主模型 + fallback 候選序列。
 * 唯讀檢視——實際排序由 provider-core 依 enabled 與候選順序執行。
 */
export default async function AdminCandidatesPage() {
  const gate = await checkSiteAdmin()
  if (!gate.ok) redirect(gate.reason === 'unauthenticated' ? '/login?next=/admin/ai/candidates' : '/home')

  const admin = createAdminClient()
  const { data } = await admin
    .from('ai_usage_models')
    .select('usage_key, model_name, candidates, enabled, updated_at')
    .order('usage_key', { ascending: true })
  const rows = (data ?? []) as Row[]

  const candList = (c: unknown): string[] => (Array.isArray(c) ? c.map((x) => String(x)) : [])

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 'var(--sr-space-6) var(--sr-space-4)' }}>
      <p className="sr-muted">
        <Link href="/admin" className="sr-link">
          ← 管理後台
        </Link>
      </p>
      <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>候選鏈</h1>
      <p className="sr-muted">每個用途的主模型與 fallback 順序。免費優先，低信心或需工具時才升級。</p>

      {rows.length === 0 ? (
        <p className="sr-muted">尚無設定（provider-core 會用內建預設鏈）。</p>
      ) : (
        <div className="sr-stack" style={{ gap: 'var(--sr-space-3)', marginTop: 'var(--sr-space-4)' }}>
          {rows.map((r) => (
            <section key={r.usage_key} className="sr-card" style={{ padding: 'var(--sr-space-4)' }}>
              <div className="sr-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--sr-space-2)' }}>
                <strong>{r.usage_key}</strong>
                <span className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)' }}>
                  {r.enabled ? '啟用中' : '停用'}
                </span>
              </div>
              <div style={{ marginTop: 'var(--sr-space-2)' }}>
                <span className="sr-muted" style={{ fontSize: 'var(--sr-text-sm)' }}>主模型：</span>
                <code>{r.model_name}</code>
              </div>
              {candList(r.candidates).length > 0 && (
                <ol className="sr-muted" style={{ margin: 'var(--sr-space-2) 0 0', paddingLeft: 'var(--sr-space-5)', fontSize: 'var(--sr-text-sm)' }}>
                  {candList(r.candidates).map((c, i) => (
                    <li key={i}>
                      <code>{c}</code>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  )
}
