import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AI_USAGE_KEYS, DEFAULT_CANDIDATES } from '@snowrealm/ai-core'
import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { ADMIN_BASE } from '@/lib/admin-path'
import { createAdminClient } from '@snowrealm/db/server'
import { CandidateChainEditor } from './CandidateChainEditor'

export const metadata: Metadata = { title: '候選鏈 — SnowRealm' }
export const dynamic = 'force-dynamic'

type Candidate = { model: string; role: 'primary' | 'fallback' | 'escalate' }

function asCandidates(c: unknown): Candidate[] | null {
  if (!Array.isArray(c)) return null
  const out: Candidate[] = []
  for (const x of c) {
    if (x && typeof x === 'object' && typeof (x as { model?: unknown }).model === 'string') {
      const role = (x as { role?: unknown }).role
      out.push({
        model: (x as { model: string }).model,
        role: role === 'primary' || role === 'fallback' || role === 'escalate' ? role : 'fallback',
      })
    }
  }
  return out.length > 0 ? out : null
}

/**
 * 候選鏈（ai_usage_models）：每個用途主模型 + fallback 候選序列。
 * DB 有覆寫用覆寫，否則顯示內建 DEFAULT_CANDIDATES。可調順序／啟用／重設。
 */
export default async function AdminCandidatesPage() {
  const gate = await checkSiteAdmin()
  if (!gate.ok) redirect(gate.reason === 'unauthenticated' ? `/login?next=${ADMIN_BASE}/ai/candidates` : '/home')

  const admin = createAdminClient()
  const { data } = await admin.from('ai_usage_models').select('usage_key, candidates, enabled')
  const overrides = new Map((data ?? []).map((r) => [r.usage_key, r]))

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 'var(--sr-space-6) var(--sr-space-4)' }}>
      <p className="sr-muted">
        <Link href={ADMIN_BASE} className="sr-link">
          ← 管理後台
        </Link>
      </p>
      <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>候選鏈</h1>
      <p className="sr-muted">
        每個用途的主模型與 fallback 順序。免費優先，低信心或需工具時才升級。
        沒有覆寫時走內建預設；儲存覆寫後由 provider-core 依此順序執行。
      </p>

      <div className="sr-stack" style={{ gap: 'var(--sr-space-3)', marginTop: 'var(--sr-space-4)' }}>
        {AI_USAGE_KEYS.map((key) => {
          const ov = overrides.get(key)
          const overrideCandidates = ov ? asCandidates(ov.candidates) : null
          const candidates = overrideCandidates ?? DEFAULT_CANDIDATES[key]
          return (
            <CandidateChainEditor
              key={key}
              usageKey={key}
              initialCandidates={candidates}
              isOverride={Boolean(overrideCandidates)}
              initialEnabled={ov?.enabled ?? true}
            />
          )
        })}
      </div>
    </main>
  )
}
