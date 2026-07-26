import type { Metadata } from 'next'
import { requireActiveSpace, getUser } from '@/lib/auth/session'
import { getDb } from '@/lib/supabase/server'
import { resolveAvatarUrl } from '@/lib/avatar'
import { AgentChat, type Attachment, type ChatMessage, type ThreadSummary } from './AgentChat'
import { AiNaming } from './AiNaming'
import { AvatarUpload } from '@/app/(space)/settings/account/AvatarUpload'

export const metadata: Metadata = { title: 'AI 夥伴 — SnowRealm Space' }
export const dynamic = 'force-dynamic'

/** agent_messages.blocks（jsonb）→ 圖片附件參照。忽略非圖片 block。 */
function blocksToAttachments(blocks: unknown): Attachment[] | undefined {
  if (!Array.isArray(blocks)) return undefined
  const out: Attachment[] = []
  for (const b of blocks) {
    if (b && typeof b === 'object' && (b as { type?: string }).type === 'image') {
      const assetId = (b as { assetId?: unknown }).assetId
      const mimeType = (b as { mimeType?: unknown }).mimeType
      if (typeof assetId === 'string') {
        out.push({ assetId, mimeType: typeof mimeType === 'string' ? mimeType : 'image/*' })
      }
    }
  }
  return out.length ? out : undefined
}

export default async function AgentPage() {
  const { space, role } = await requireActiveSpace()
  const user = await getUser()
  const db = await getDb()

  // 使用者與 AI 夥伴的名字＋頭像（對話兩邊各自顯示）
  const [{ data: myProfile }, { data: agentProfile }] = await Promise.all([
    user
      ? db.from('profiles').select('display_name, avatar_asset_id').eq('id', user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    db.from('agent_profiles').select('display_name, avatar_asset_id').eq('space_id', space.id).maybeSingle(),
  ])
  const [userAvatarSrc, agentAvatarSrc] = await Promise.all([
    resolveAvatarUrl(db, myProfile?.avatar_asset_id ?? null),
    resolveAvatarUrl(db, agentProfile?.avatar_asset_id ?? null),
  ])
  const userName = myProfile?.display_name || user?.username || user?.email || '你'
  // 預設名 'Agent' 視為「還沒取名」→ 顯示成「AI 夥伴」，並引導使用者命名
  const rawAgentName = agentProfile?.display_name ?? 'Agent'
  const agentUnnamed = !rawAgentName || rawAgentName === 'Agent'
  const agentName = agentUnnamed ? 'AI 夥伴' : rawAgentName

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
      .select('id, role, content, escalated, blocks')
      .eq('thread_id', thread.id)
      .order('created_at', { ascending: true })
      .limit(50)
    messages = (msgs ?? [])
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => {
        const attachments = blocksToAttachments(m.blocks)
        return {
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content ?? '',
          escalated: m.escalated ?? false,
          ...(attachments ? { attachments } : {}),
        }
      })
  }

  return (
    <div className="sr-stack" data-tour="agent-chat">
      <section>
        <h1 style={{ fontSize: 'var(--sr-text-h1)' }}>AI 夥伴</h1>
        <p className="sr-muted">
          這個空間的 AI 夥伴。它只看得到你提供的內容，不會假裝看過沒看過的東西。
        </p>
      </section>

      <AiNaming
        spaceId={space.id}
        initialName={rawAgentName}
        isDefault={agentUnnamed}
        canEdit={role === 'owner'}
      />

      {role === 'owner' && (
        <section className="sr-card">
          <h2 style={{ fontSize: 'var(--sr-text-lg)', marginTop: 0, marginBottom: 'var(--sr-space-2)' }}>
            AI 夥伴的大頭貼
          </h2>
          <p className="sr-muted" style={{ marginTop: 0, marginBottom: 'var(--sr-space-4)' }}>
            上傳一張圖片當 {agentName} 的頭像，對話裡就會看到它。
          </p>
          <AvatarUpload
            spaceId={space.id}
            initialAssetId={agentProfile?.avatar_asset_id ?? null}
            endpoint="/api/agent/profile"
            field="avatarAssetId"
            uploadLabel="上傳頭像"
          />
        </section>
      )}

      <AgentChat
        spaceId={space.id}
        initialThreadId={thread?.id ?? null}
        initialMessages={messages}
        initialThreads={threads}
        userName={userName}
        userAvatarSrc={userAvatarSrc}
        agentName={agentName}
        agentAvatarSrc={agentAvatarSrc}
      />
    </div>
  )
}
