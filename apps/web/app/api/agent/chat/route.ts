import type { NextRequest } from 'next/server'
import { agentChatSchema } from '@snowrealm/validation'
import {
  completeForUsage,
  buildAgentSystemPrompt,
  QuotaExceededError,
  AllCandidatesFailedError,
  type AIMessage,
} from '@snowrealm/ai-core'
import { createAdminClient } from '@snowrealm/db/server'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'
import { buildAgentContext } from '@/lib/agent/context'
import { buildCompleteDeps } from '@/lib/ai/deps'

export const dynamic = 'force-dynamic'

const HISTORY_LIMIT = 12

/**
 * Agent 對話（07-agent.md）。
 *
 * 訊息寫入走 service role（agent_messages 對成員唯讀）。
 * 沒設 AI 金鑰時 completeForUsage 拋 AllCandidatesFailedError —— 這裡回 503 並
 * **保留使用者輸入**（前端不清空、給重試），絕不生成假結果（v1.0 §46.2）。
 */
export const POST = handler(async (request: NextRequest) => {
  const result = await resolveContext()
  if (!result.ok) {
    if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
    return fail('FORBIDDEN', '你沒有這個空間的存取權。')
  }
  const { ctx } = result

  const body: unknown = await request.json().catch(() => null)
  const parsed = agentChatSchema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)
  const input = parsed.data

  const admin = createAdminClient()

  // 取得或建立 thread
  let threadId = input.threadId ?? null
  if (threadId) {
    const { data: t } = await ctx.db
      .from('agent_threads')
      .select('id')
      .eq('id', threadId)
      .eq('space_id', ctx.spaceId)
      .is('deleted_at', null)
      .maybeSingle()
    if (!t) threadId = null
  }
  if (!threadId) {
    const { data: created, error } = await admin
      .from('agent_threads')
      .insert({ space_id: ctx.spaceId, created_by: ctx.userId, mode: 'companion' })
      .select('id')
      .single()
    if (error || !created) return fail('INTERNAL', '無法建立對話。')
    threadId = created.id
  }

  // 存使用者訊息
  await admin.from('agent_messages').insert({
    space_id: ctx.spaceId,
    thread_id: threadId,
    role: 'user',
    content: input.message,
  })

  // 對話歷史（最近 N 則，時間正序）
  const { data: history } = await ctx.db
    .from('agent_messages')
    .select('role, content')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT)
  const historyMessages: AIMessage[] = (history ?? [])
    .reverse()
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content ?? '' }))

  // 組 system prompt（含當前脈絡）
  const agentCtx = await buildAgentContext(ctx, {
    ...(input.route ? { route: input.route } : {}),
    ...(input.selectedSnapshotId ? { selectedSnapshotId: input.selectedSnapshotId } : {}),
  })
  const system = buildAgentSystemPrompt(agentCtx)

  const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: agentCtx.timezone }).format(new Date())
  const deps = await buildCompleteDeps(ctx.spaceId, localDate)

  try {
    const completion = await completeForUsage(
      'agent_chat',
      { spaceId: ctx.spaceId, system, user: historyMessages },
      deps,
    )

    // 存助理訊息
    await admin.from('agent_messages').insert({
      space_id: ctx.spaceId,
      thread_id: threadId,
      role: 'assistant',
      content: completion.text,
      model_used: completion.model,
      provider: completion.provider,
      is_free: completion.isFree,
      escalated: completion.escalated,
    })
    await admin.from('agent_threads').update({ last_message_at: new Date().toISOString() }).eq('id', threadId)

    return ok({
      threadId,
      reply: completion.text,
      model: completion.model,
      isFree: completion.isFree,
      escalated: completion.escalated,
      degraded: completion.degraded,
    })
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      return fail('AI_QUOTA_EXCEEDED', err.message, { threadId })
    }
    if (err instanceof AllCandidatesFailedError) {
      // 沒金鑰或全部候選失敗 —— 保留使用者輸入、可重試，不生成假結果
      return fail('AI_UNAVAILABLE', 'AI 暫時無法回應（可能尚未設定金鑰），請稍後再試。', {
        threadId,
      })
    }
    console.error('[agent.chat] 未預期錯誤', (err as Error).message)
    return fail('INTERNAL', 'AI 回應時發生問題，請重試。', { threadId })
  }
})
