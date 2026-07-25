import type { Metadata } from 'next'
import { requireActiveSpace } from '@/lib/auth/session'
import { getDb } from '@/lib/supabase/server'
import { AgentChat, type ChatMessage, type ThreadSummary } from './AgentChat'

export const metadata: Metadata = { title: 'Agent — SnowRealm Space' }
export const dynamic = 'force-dynamic'

export default async function AgentPage() {
  const { space } = await requireActiveSpace()
  const db = await getDb()

  // 對話清單 + 最近一個對話的訊息
  const { data: threadRows } = await db
    .from('agent_threads')
    .select('id, title, last_message_at')
    .eq('space_id', space.id)
    .is('deleted_at', null)
    .order('last_message_at', { ascending: false })
    .limit(100)
  const threads = (threadRows ?? []) as ThreadSummary[]
  const thread = threads[0] ?? null

  let messages: ChatMessage[] = []
  if (thread) {
    const { data: msgs } = await db
      .from('agent_messages')
      .select('id, role, content, escalated')
      .eq('thread_id', thread.id)
      .order('created_at', { ascending: true })
      .limit(50)
    messages = (msgs ?? [])
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content ?? '',
        escalated: m.escalated ?? false,
      }))
  }

  return (
    <div className="sr-stack" data-tour="agent-chat">
      <section>
        <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>Agent</h1>
        <p className="sr-muted">
          這個空間的 AI 夥伴。它只看得到你提供的內容，不會假裝看過沒看過的東西。
        </p>
      </section>

      <AgentChat
        spaceId={space.id}
        initialThreadId={thread?.id ?? null}
        initialMessages={messages}
        initialThreads={threads}
      />
    </div>
  )
}
