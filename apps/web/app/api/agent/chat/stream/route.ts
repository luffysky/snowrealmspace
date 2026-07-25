import type { NextRequest } from 'next/server'
import { agentChatSchema } from '@snowrealm/validation'
import {
  completeForUsage,
  callAIStream,
  buildAgentSystemPrompt,
  splitProviderPrefix,
  providerFromModel,
  AllCandidatesFailedError,
  QuotaExceededError,
  type AIMessage,
  type ProviderId,
} from '@snowrealm/ai-core'
import { createAdminClient } from '@snowrealm/db/server'
import { resolveContext } from '@/lib/api/context'
import { fail, failValidation } from '@/lib/api/respond'
import { buildAgentContext } from '@/lib/agent/context'
import { buildCompleteDeps } from '@/lib/ai/deps'
import { embedForUsage } from '@/lib/ai/embed'

export const dynamic = 'force-dynamic'

const HISTORY_LIMIT = 12

/** openai 相容協定的 provider 才能串流（Groq/OpenAI/…）。Anthropic/Google 不行 → 退非串流。 */
function isStreamable(provider: ProviderId): boolean {
  return provider !== 'anthropic' && provider !== 'google'
}

/**
 * Agent 對話（串流版）。純文字聊天用這條 —— 逐字吐（SSE）。
 * 帶圖片、需要工具的走非串流 /api/agent/chat。
 * Groq(llama-3.3) 是 openai 相容協定，串流；沒有可串流候選時退回非串流、整段一次吐。
 */
export async function POST(request: NextRequest): Promise<Response> {
  const result = await resolveContext()
  if (!result.ok) {
    return result.reason === 'unauthenticated'
      ? fail('UNAUTHENTICATED', '請先登入。')
      : fail('FORBIDDEN', '你沒有這個空間的存取權。')
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
    const title = input.message.trim().slice(0, 40) || '新對話'
    const { data: created, error } = await admin
      .from('agent_threads')
      .insert({ space_id: ctx.spaceId, created_by: ctx.userId, mode: 'companion', title })
      .select('id')
      .single()
    if (error || !created) return fail('INTERNAL', '無法建立對話。')
    threadId = created.id
  }

  await admin.from('agent_messages').insert({
    space_id: ctx.spaceId,
    thread_id: threadId,
    role: 'user',
    content: input.message,
  })

  const { data: history } = await ctx.db
    .from('agent_messages')
    .select('role, content')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT)
  const messages: AIMessage[] = (history ?? [])
    .reverse()
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content ?? '' }))

  const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date())
  const deps = await buildCompleteDeps(ctx.spaceId, localDate, ctx.userId)

  // 語意記憶檢索：把這次訊息向量化，讓 context 挑「最相關」而非「最近」的記憶。
  // 缺 embedding 金鑰時回 null，context 自動退回時間序（不擋對話）。
  const queryEmbedding = await embedForUsage(input.message, deps)

  const agentCtx = await buildAgentContext(ctx, {
    ...(input.route ? { route: input.route } : {}),
    ...(input.selectedSnapshotId ? { selectedSnapshotId: input.selectedSnapshotId } : {}),
    ...(queryEmbedding ? { queryEmbedding } : {}),
  })
  const system = buildAgentSystemPrompt(agentCtx)

  // 額度閘門（串流前先擋，才不會吐一半才發現沒額度）
  const budget = await deps.budget(ctx.spaceId)
  if (budget.freeExhausted) return fail('AI_QUOTA_EXCEEDED', '今日免費額度已用盡，明日 00:00 重置。', { threadId })

  // 找第一個「有金鑰且可串流」的候選
  const chain = await deps.getCandidates('agent_chat')
  let picked: { provider: ProviderId; model: string; apiKey: string } | null = null
  for (const c of chain) {
    const sp = splitProviderPrefix(c.model)
    const provider = (sp.provider ?? providerFromModel(c.model)) as ProviderId
    if (!isStreamable(provider)) continue
    const apiKey = await deps.getKey(provider)
    if (apiKey) {
      picked = { provider, model: sp.model, apiKey }
      break
    }
  }

  const enc = new TextEncoder()
  const streamMessages: AIMessage[] = [{ role: 'system', content: system }, ...messages]

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`))
      let full = ''
      try {
        if (picked) {
          for await (const delta of callAIStream({
            provider: picked.provider,
            model: picked.model,
            apiKey: picked.apiKey,
            messages: streamMessages,
          })) {
            full += delta
            send({ delta })
          }
        }
        // 沒有可串流候選、或串流中途沒吐任何字 → 退回非串流一次拿完
        if (!full) {
          const c = await completeForUsage('agent_chat', { spaceId: ctx.spaceId, system, user: messages }, deps)
          full = c.text
          if (full) send({ delta: full })
        }
      } catch (err) {
        if (!full) {
          // 串流失敗且沒吐字 → 試非串流備援
          try {
            const c = await completeForUsage('agent_chat', { spaceId: ctx.spaceId, system, user: messages }, deps)
            full = c.text
            if (full) send({ delta: full })
          } catch (e2) {
            const msg =
              e2 instanceof QuotaExceededError
                ? '今日額度已用盡。'
                : e2 instanceof AllCandidatesFailedError
                  ? 'AI 暫時無法回應（可能尚未設定金鑰）。'
                  : 'AI 回應時發生問題。'
            send({ error: msg })
          }
        } else {
          // 已吐一部分，串流斷了 → 就用已收到的
          console.error('[agent.chat.stream] 串流中斷', (err as Error).message)
        }
      }

      // 存助理訊息 + 更新 thread
      if (full) {
        await admin.from('agent_messages').insert({
          space_id: ctx.spaceId,
          thread_id: threadId,
          role: 'assistant',
          content: full,
        })
        await admin.from('agent_threads').update({ last_message_at: new Date().toISOString() }).eq('id', threadId)
      }
      send({ done: true, threadId })
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store, no-transform',
      connection: 'keep-alive',
    },
  })
}
