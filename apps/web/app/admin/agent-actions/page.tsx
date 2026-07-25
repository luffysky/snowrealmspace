import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { ADMIN_BASE } from '@/lib/admin-path'
import { createAdminClient } from '@snowrealm/db/server'

export const metadata: Metadata = { title: 'Agent 動作 — SnowRealm' }
export const dynamic = 'force-dynamic'

type Row = {
  id: string
  space_id: string
  tool_name: string
  status: string
  requires_confirmation: boolean
  error: string | null
  created_at: string
}

/**
 * Agent 動作（agent_actions）：Agent 執行過的工具呼叫紀錄。
 * 唯讀。用來查「Agent 到底做了什麼」與失敗的工具呼叫。
 */
export default async function AdminAgentActionsPage() {
  const gate = await checkSiteAdmin()
  if (!gate.ok) redirect(gate.reason === 'unauthenticated' ? `/login?next=${ADMIN_BASE}/agent-actions` : '/home')

  const admin = createAdminClient()
  const { data } = await admin
    .from('agent_actions')
    .select('id, space_id, tool_name, status, requires_confirmation, error, created_at')
    .order('created_at', { ascending: false })
    .limit(200)
  const rows = (data ?? []) as Row[]

  const failed = rows.filter((r) => r.status === 'failed' || r.error)

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 'var(--sr-space-6) var(--sr-space-4)' }}>
      <p className="sr-muted">
        <Link href={ADMIN_BASE} className="sr-link">
          ← 管理後台
        </Link>
      </p>
      <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>Agent 動作</h1>
      <p className="sr-muted">
        最近 200 筆工具呼叫，其中 {failed.length} 筆失敗。Agent 沒有刪除／封存／對外分享／上傳工具（設計如此）。
      </p>

      {rows.length === 0 ? (
        <p className="sr-muted">Agent 尚未執行任何工具。</p>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: 'var(--sr-space-4)' }}>
          <table className="sr-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--sr-text-sm)' }}>
            <thead>
              <tr style={{ textAlign: 'left' }}>
                <th style={{ padding: 'var(--sr-space-2)' }}>時間</th>
                <th style={{ padding: 'var(--sr-space-2)' }}>工具</th>
                <th style={{ padding: 'var(--sr-space-2)' }}>Space</th>
                <th style={{ padding: 'var(--sr-space-2)' }}>狀態</th>
                <th style={{ padding: 'var(--sr-space-2)' }}>錯誤</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderTop: '1px solid var(--sr-border)' }}>
                  <td className="sr-muted" style={{ padding: 'var(--sr-space-2)', whiteSpace: 'nowrap' }}>
                    {new Date(r.created_at).toLocaleString('zh-TW')}
                  </td>
                  <td style={{ padding: 'var(--sr-space-2)' }}>
                    <code style={{ fontSize: 'var(--sr-text-xs)' }}>{r.tool_name}</code>
                    {r.requires_confirmation && <span className="sr-muted"> ·需確認</span>}
                  </td>
                  <td style={{ padding: 'var(--sr-space-2)' }}>
                    <code style={{ fontSize: 'var(--sr-text-xs)' }}>{r.space_id.slice(0, 8)}…</code>
                  </td>
                  <td style={{ padding: 'var(--sr-space-2)' }}>{r.status}</td>
                  <td className="sr-muted" style={{ padding: 'var(--sr-space-2)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.error ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
