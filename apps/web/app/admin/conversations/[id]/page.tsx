import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { ADMIN_BASE } from '@/lib/admin-path'
import { createAdminClient } from '@snowrealm/db/server'
import { audit } from '@snowrealm/analytics'

export const metadata: Metadata = { title: '對話詳情 — SnowRealm' }
export const dynamic = 'force-dynamic'

type Msg = {
  id: string
  role: string
  content: string | null
  model_used: string | null
  provider: string | null
  is_free: boolean | null
  created_at: string
}

const ROLE_LABEL: Record<string, string> = { user: '使用者', assistant: 'AI', tool: '工具' }

/**
 * 單一對話詳情（平台維護，唯讀）。開啟即寫 audit_logs（誰、看了哪個 space 的哪串對話）——
 * 存取私人內容要留痕，這是對使用者最起碼的問責。
 */
export default async function ConversationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const gate = await checkSiteAdmin()
  if (!gate.ok) redirect(gate.reason === 'unauthenticated' ? `/login?next=${ADMIN_BASE}/conversations` : '/home')
  const { id } = await params

  const admin = createAdminClient()
  const { data: thread } = await admin
    .from('agent_threads')
    .select('id, space_id, created_by, title, mode, summary')
    .eq('id', id)
    .maybeSingle()

  if (!thread) {
    return (
      <main style={{ maxWidth: 820, margin: '0 auto', padding: 'var(--sr-space-6) var(--sr-space-4)' }}>
        <p className="sr-muted"><Link href={`${ADMIN_BASE}/conversations`} className="sr-link">← 對話紀錄</Link></p>
        <p className="sr-muted">找不到這個對話。</p>
      </main>
    )
  }

  const { data: msgData } = await admin
    .from('agent_messages')
    .select('id, role, content, model_used, provider, is_free, created_at')
    .eq('thread_id', id)
    .order('created_at', { ascending: true })
    .limit(500)
  const messages = (msgData ?? []) as Msg[]

  // 稽核：管理員存取了私人對話內容
  const h = await headers()
  await audit({
    spaceId: thread.space_id,
    actorId: gate.userId,
    actorType: 'user',
    action: 'admin.conversation.viewed',
    entityType: 'agent_thread',
    entityId: id,
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim(),
    userAgent: h.get('user-agent') ?? undefined,
  })

  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: 'var(--sr-space-6) var(--sr-space-4)' }}>
      <p className="sr-muted"><Link href={`${ADMIN_BASE}/conversations`} className="sr-link">← 對話紀錄</Link></p>
      <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>{thread.title || '（未命名對話）'}</h1>
      <p className="sr-muted">
        {thread.mode} ·{' '}
        <Link href={`${ADMIN_BASE}/spaces/${thread.space_id}`} className="sr-link">看空間</Link>
        {thread.created_by && (
          <>
            {' · '}
            <Link href={`${ADMIN_BASE}/users/${thread.created_by}`} className="sr-link">看發起人</Link>
          </>
        )}
      </p>
      <p className="sr-muted" style={{ fontSize: 'var(--sr-text-xs)' }}>你開啟這則對話的存取已記入稽核。</p>

      {thread.summary && (
        <section className="sr-card" style={{ marginTop: 'var(--sr-space-3)' }}>
          <span className="sr-label">摘要</span>
          <p style={{ margin: '4px 0 0' }}>{thread.summary}</p>
        </section>
      )}

      <div className="sr-stack" style={{ gap: 'var(--sr-space-2)', marginTop: 'var(--sr-space-4)' }}>
        {messages.length === 0 ? (
          <p className="sr-muted">這個對話沒有訊息。</p>
        ) : (
          messages.map((m) => (
            <section
              key={m.id}
              className="sr-card"
              style={{ padding: 'var(--sr-space-3)', borderLeft: `3px solid ${m.role === 'assistant' ? 'var(--sr-accent)' : 'var(--sr-border)'}` }}
            >
              <div className="sr-row" style={{ justifyContent: 'space-between', gap: 'var(--sr-space-2)', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: 'var(--sr-text-sm)' }}>{ROLE_LABEL[m.role] ?? m.role}</strong>
                <span className="sr-muted" style={{ fontSize: 'var(--sr-text-xs)' }}>
                  {m.model_used ? `${m.provider}/${m.model_used}${m.is_free ? '·免費' : ''} · ` : ''}
                  {new Date(m.created_at).toLocaleString('zh-TW')}
                </span>
              </div>
              <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{m.content ?? '（無文字內容）'}</p>
            </section>
          ))
        )}
      </div>
    </main>
  )
}
