import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { ADMIN_BASE } from '@/lib/admin-path'
import { createAdminClient } from '@snowrealm/db/server'

export const metadata: Metadata = { title: '整合狀態 — SnowRealm' }
export const dynamic = 'force-dynamic'

type KeyRow = {
  provider: string
  enabled: boolean
  last_ok_at: string | null
  last_error: string | null
  monthly_budget_usd: number | null
  used_this_month_usd: number | null
}
type Hook = { provider: string; signature_ok: boolean | null; received_at: string; processed_at: string | null }

function Badge({ ok, on = '已設定', off = '未設定' }: { ok: boolean; on?: string; off?: string }) {
  return (
    <span
      className="sr-badge"
      style={{ background: ok ? 'var(--sr-accent)' : 'var(--sr-surface)', color: ok ? 'var(--sr-on-accent)' : 'var(--sr-text-secondary)', fontSize: 'var(--sr-text-xs)' }}
    >
      {ok ? on : off}
    </span>
  )
}

/**
 * 整合狀態（唯讀）：登入方式、AI 供應商、Figma、Webhook 收據。
 * 設定與否從 env 判定；金鑰/密鑰不顯示，只顯示狀態。
 */
export default async function AdminIntegrationsPage() {
  const gate = await checkSiteAdmin()
  if (!gate.ok) redirect(gate.reason === 'unauthenticated' ? `/login?next=${ADMIN_BASE}/integrations` : '/home')

  const admin = createAdminClient()
  const [{ data: keyData }, { data: hookData }] = await Promise.all([
    admin.from('ai_provider_keys').select('provider, enabled, last_ok_at, last_error, monthly_budget_usd, used_this_month_usd'),
    admin.from('provider_webhooks').select('provider, signature_ok, received_at, processed_at').order('received_at', { ascending: false }).limit(30),
  ])
  const keys = (keyData ?? []) as KeyRow[]
  const hooks = (hookData ?? []) as Hook[]

  const google = Boolean(process.env['GOOGLE_OAUTH_CLIENT_ID'] && process.env['GOOGLE_OAUTH_CLIENT_SECRET'])
  const line = Boolean(process.env['LINE_LOGIN_CHANNEL_ID'] && process.env['LINE_LOGIN_CHANNEL_SECRET'])
  const figma = Boolean(process.env['FIGMA_CLIENT_ID'] && process.env['FIGMA_CLIENT_SECRET'])
  const resend = Boolean(process.env['RESEND_API_KEY'] || process.env['GOTRUE_SMTP_PASS'])

  const td = { padding: 'var(--sr-space-2)' }
  const th = { ...td, textAlign: 'left' as const }

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 'var(--sr-space-6) var(--sr-space-4)' }}>
      <p className="sr-muted">
        <Link href={ADMIN_BASE} className="sr-link">← 管理後台</Link>
      </p>
      <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>整合狀態</h1>
      <p className="sr-muted">第三方整合的設定與健康。密鑰不顯示，只看狀態。</p>

      <section className="sr-card" style={{ marginTop: 'var(--sr-space-4)' }}>
        <h2 className="sr-section-title">登入方式</h2>
        <ul className="sr-stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 'var(--sr-space-2)' }}>
          <li className="sr-row" style={{ justifyContent: 'space-between' }}><span>Email / Magic link</span><Badge ok on="內建" /></li>
          <li className="sr-row" style={{ justifyContent: 'space-between' }}><span>Google 登入</span><Badge ok={google} /></li>
          <li className="sr-row" style={{ justifyContent: 'space-between' }}><span>LINE 登入</span><Badge ok={line} /></li>
          <li className="sr-row" style={{ justifyContent: 'space-between' }}><span>Email 寄送（Resend/SMTP）</span><Badge ok={resend} /></li>
        </ul>
      </section>

      <section className="sr-card" style={{ marginTop: 'var(--sr-space-4)' }}>
        <h2 className="sr-section-title">AI 供應商</h2>
        {keys.length === 0 ? (
          <p className="sr-muted" style={{ margin: 0 }}>
            還沒有任何 AI 金鑰。到 <Link href={`${ADMIN_BASE}/ai-keys`} className="sr-link">AI 金鑰</Link> 設定。
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="sr-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--sr-text-sm)' }}>
              <thead>
                <tr>
                  <th style={th}>Provider</th>
                  <th style={th}>狀態</th>
                  <th style={th}>上次成功</th>
                  <th style={{ ...th, textAlign: 'right' }}>本月用量</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.provider} style={{ borderTop: '1px solid var(--sr-border)' }}>
                    <td style={td}>{k.provider}</td>
                    <td style={td}>
                      <Badge ok={k.enabled} on="啟用" off="停用" />
                      {k.last_error && <span className="sr-muted" style={{ fontSize: 'var(--sr-text-xs)', marginLeft: 6, color: 'var(--sr-danger)' }}>有錯誤</span>}
                    </td>
                    <td className="sr-muted" style={td}>{k.last_ok_at ? new Date(k.last_ok_at).toLocaleString('zh-TW') : '—'}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      ${Number(k.used_this_month_usd ?? 0).toFixed(2)}
                      {k.monthly_budget_usd ? ` / $${Number(k.monthly_budget_usd).toFixed(0)}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="sr-card" style={{ marginTop: 'var(--sr-space-4)' }}>
        <h2 className="sr-section-title">Figma / Webhook</h2>
        <div className="sr-row" style={{ justifyContent: 'space-between', marginBottom: 'var(--sr-space-2)' }}>
          <span>Figma 整合</span>
          <Badge ok={figma} />
        </div>
        {hooks.length === 0 ? (
          <p className="sr-muted" style={{ margin: 0 }}>還沒有收到任何 webhook。</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="sr-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--sr-text-sm)' }}>
              <thead>
                <tr>
                  <th style={th}>來源</th>
                  <th style={th}>簽章</th>
                  <th style={th}>收到</th>
                  <th style={th}>處理</th>
                </tr>
              </thead>
              <tbody>
                {hooks.map((h, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--sr-border)' }}>
                    <td style={td}>{h.provider}</td>
                    <td style={td}>{h.signature_ok === null ? '—' : h.signature_ok ? '✓' : '✗'}</td>
                    <td className="sr-muted" style={td}>{new Date(h.received_at).toLocaleString('zh-TW')}</td>
                    <td className="sr-muted" style={td}>{h.processed_at ? '已處理' : '待處理'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
