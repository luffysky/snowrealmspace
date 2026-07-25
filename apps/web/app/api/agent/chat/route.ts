import type { NextRequest } from 'next/server'
import { agentChatSchema } from '@snowrealm/validation'
import {
  completeForUsage,
  buildAgentSystemPrompt,
  toProviderTools,
  QuotaExceededError,
  AllCandidatesFailedError,
  type AIMessage,
  type AIContentBlock,
} from '@snowrealm/ai-core'
import { storage } from '@snowrealm/storage'
import { createAdminClient } from '@snowrealm/db/server'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'
import { buildAgentContext } from '@/lib/agent/context'
import { buildCompleteDeps } from '@/lib/ai/deps'
import { executeToolCall } from '@/lib/agent/tools'

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

  // ── 圖片附件（多模態）──────────────────────────────────
  // 走既有 assets 管線：位元組只在 assets（ADR-005）。這裡用受 RLS 約束的 db 讀，
  // 不是成員就查不到；讀出真實位元組轉 base64 塞進 vision 訊息。
  const attachmentIds = input.attachmentAssetIds ?? []
  const imageBlocks: AIContentBlock[] = []
  const attachmentRefs: { type: 'image'; assetId: string; mimeType: string }[] = []
  if (attachmentIds.length) {
    const { data: rows } = await ctx.db
      .from('assets')
      .select('id, storage_key, mime_type, kind, bytes, status')
      .in('id', attachmentIds)
      .eq('space_id', ctx.spaceId)
      .eq('kind', 'image')
      .is('deleted_at', null)
    for (const a of rows ?? []) {
      if (a.status !== 'ready') continue
      if (a.bytes > 8 * 1024 * 1024) continue // 8MB：避免 base64 撐爆 request body
      try {
        const bytes = await storage().get(a.storage_key)
        imageBlocks.push({
          type: 'image',
          mediaType: a.mime_type,
          data: Buffer.from(bytes).toString('base64'),
        })
        attachmentRefs.push({ type: 'image', assetId: a.id, mimeType: a.mime_type })
      } catch {
        // 讀不到就跳過這張 —— 誠實：不假裝看得到（§靜默失敗是 bug 的反面：這裡是「部分成功」）
      }
    }
  }
  const hasImages = imageBlocks.length > 0

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
    // 用第一句話當標題（截斷），對話列表才認得出來
    const title =
      input.message.trim().slice(0, 40) || (attachmentIds.length ? '圖片對話' : '新對話')
    const { data: created, error } = await admin
      .from('agent_threads')
      .insert({ space_id: ctx.spaceId, created_by: ctx.userId, mode: 'companion', title })
      .select('id')
      .single()
    if (error || !created) return fail('INTERNAL', '無法建立對話。')
    threadId = created.id
  }

  // 存使用者訊息（blocks 記附件參照，供歷史重繪縮圖）
  await admin.from('agent_messages').insert({
    space_id: ctx.spaceId,
    thread_id: threadId,
    role: 'user',
    content: input.message,
    blocks: attachmentRefs,
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

  // 帶圖時：把圖片塞進「這一輪」的使用者訊息（歷史保持純文字，省 token）。
  if (hasImages && historyMessages.length) {
    const last = historyMessages[historyMessages.length - 1]
    if (last && last.role === 'user') {
      const text =
        input.message || '看看這張圖片，用溫暖的語氣跟我說你看到什麼、有什麼想法。'
      last.content = [{ type: 'text', text }, ...imageBlocks]
    }
  }

  // 組 system prompt（含當前脈絡）
  const agentCtx = await buildAgentContext(ctx, {
    ...(input.route ? { route: input.route } : {}),
    ...(input.selectedSnapshotId ? { selectedSnapshotId: input.selectedSnapshotId } : {}),
  })
  const system = buildAgentSystemPrompt(agentCtx)

  const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: agentCtx.timezone }).format(new Date())
  const deps = await buildCompleteDeps(ctx.spaceId, localDate, ctx.userId)

  try {
    // 帶上工具 —— 模型可決定要不要動手做事（07-agent.md §5）。
    // 帶圖時走 vision 候選鏈，且先不帶工具（多數免費 vision 模型不支援 tools+image 併用）。
    const completion = hasImages
      ? await completeForUsage(
          'agent_chat_vision',
          { spaceId: ctx.spaceId, system, user: historyMessages },
          deps,
        )
      : await completeForUsage(
          'agent_chat',
          { spaceId: ctx.spaceId, system, user: historyMessages, tools: toProviderTools() },
          deps,
        )

    let reply = completion.text
    const actions: { tool: string; status: string; actionId?: string; reason?: string }[] = []

    // 先存助理訊息（工具動作用 message_id 連回這則）
    const { data: asstMsg } = await admin
      .from('agent_messages')
      .insert({
        space_id: ctx.spaceId,
        thread_id: threadId,
        role: 'assistant',
        content: completion.text,
        model_used: completion.model,
        provider: completion.provider,
        is_free: completion.isFree,
        escalated: completion.escalated,
      })
      .select('id')
      .single()
    const messageId = (asstMsg as { id: string } | null)?.id

    // 執行模型呼叫的工具（需確認的 → pending，UI 再確認；其餘即時執行、24h 可復原）
    if (completion.toolCalls?.length && messageId) {
      for (const tc of completion.toolCalls) {
        const outcome = await executeToolCall(ctx, tc.name, tc.arguments, messageId)
        actions.push(
          outcome.status === 'rejected'
            ? { tool: tc.name, status: 'rejected', reason: outcome.reason }
            : { tool: tc.name, status: outcome.status, actionId: outcome.actionId },
        )
      }
      // 追問：讓模型用自然語言說明做了什麼（訊息型別無 tool role，用文字注入結果）
      const summary = actions
        .map((a) => `- ${a.tool}：${a.status === 'executed' ? '已完成' : a.status === 'pending_confirmation' ? '待你確認' : '未執行（' + (a.reason ?? '') + '）'}`)
        .join('\n')
      try {
        const follow = await completeForUsage(
          'agent_chat',
          {
            spaceId: ctx.spaceId,
            system,
            user: [
              ...historyMessages,
              { role: 'assistant', content: completion.text || '（我呼叫了工具）' },
              { role: 'user', content: `工具執行結果：\n${summary}\n\n用一兩句自然、溫暖的話告訴我你做了什麼；待確認的請說要我確認。` },
            ],
          },
          deps,
        )
        if (follow.text) {
          reply = follow.text
          await admin.from('agent_messages').update({ content: reply }).eq('id', messageId)
        }
      } catch {
        // 追問失敗就保留原 reply，不擋
      }
    }

    await admin.from('agent_threads').update({ last_message_at: new Date().toISOString() }).eq('id', threadId)

    return ok({
      threadId,
      reply,
      model: completion.model,
      isFree: completion.isFree,
      escalated: completion.escalated,
      degraded: completion.degraded,
      ...(actions.length ? { actions } : {}),
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
