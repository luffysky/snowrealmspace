import { createHash } from 'node:crypto'
import {
  callAI,
  createKeyResolver,
  providerFromModel,
  DEFAULT_CANDIDATES,
  normalizeQuestion,
  type CompleteDeps,
  type UsageCandidate,
  type AiUsageKey,
  type ProviderId,
  type AIMessage,
} from '@snowrealm/ai-core'
import { createAdminClient, type Db } from '@snowrealm/db/server'
import { serverEnv } from '@snowrealm/shared-types'

/**
 * 把 @snowrealm/ai-core 的 completeForUsage 接上真實 Supabase。
 * 見 docs/spec/12-ai-model-routing.md。
 *
 * 缺金鑰時 getKey 回 null，路由層跳過該候選 —— 「只設兩把免費金鑰」也能跑，
 * 一把都沒設時所有候選被跳過、拋 AllCandidatesFailedError（誠實失敗，不假裝有答案）。
 */

// 每日額度上限（§4.5、§11：付費 20 次）。免費層寬鬆。
const FREE_DAILY_CAP = 300
const PAID_DAILY_CAP = 20

type ModelInfo = { isFree: boolean; costInput: number; costOutput: number }

async function loadModels(admin: Db): Promise<Map<string, ModelInfo>> {
  const { data } = await admin
    .from('ai_models')
    .select('provider, model_name, is_free, cost_input_per_1m, cost_output_per_1m')
  const map = new Map<string, ModelInfo>()
  for (const m of data ?? []) {
    map.set(`${m.provider}:${m.model_name}`, {
      isFree: m.is_free,
      costInput: Number(m.cost_input_per_1m),
      costOutput: Number(m.cost_output_per_1m),
    })
    map.set(m.model_name, {
      isFree: m.is_free,
      costInput: Number(m.cost_input_per_1m),
      costOutput: Number(m.cost_output_per_1m),
    })
  }
  return map
}

function hashPrompt(usageKey: string, spaceId: string, prompt: string): string {
  return createHash('sha256').update(`${usageKey}|${spaceId}|${normalizeQuestion(prompt)}`).digest('hex')
}

export async function buildCompleteDeps(spaceId: string, localDate: string): Promise<CompleteDeps> {
  const admin = createAdminClient()
  const env = serverEnv()
  const models = await loadModels(admin)

  const getKey = createKeyResolver({
    encryptionSecret: env.AI_KEY_ENCRYPTION_SECRET,
    env: process.env,
    fetchEncrypted: async (provider: ProviderId) => {
      const { data } = await admin
        .from('ai_provider_keys')
        .select('api_key_encrypted, enabled')
        .eq('provider', provider)
        .maybeSingle()
      return data?.enabled ? data.api_key_encrypted : null
    },
  })

  const isFree = (model: string): boolean => models.get(model)?.isFree ?? false

  return {
    getKey,
    isFree,

    getCandidates: async (usageKey: AiUsageKey): Promise<UsageCandidate[]> => {
      const { data } = await admin
        .from('ai_usage_models')
        .select('candidates, enabled')
        .eq('usage_key', usageKey)
        .maybeSingle()
      const fromDb = data?.enabled ? (data.candidates as UsageCandidate[] | null) : null
      if (fromDb && fromDb.length > 0) return fromDb
      return DEFAULT_CANDIDATES[usageKey]
    },

    budget: async (space: string) => {
      const { data } = await admin
        .from('ai_daily_quota')
        .select('free_calls, paid_calls')
        .eq('space_id', space)
        .eq('local_date', localDate)
        .maybeSingle()
      return {
        freeExhausted: (data?.free_calls ?? 0) >= FREE_DAILY_CAP,
        paidExhausted: (data?.paid_calls ?? 0) >= PAID_DAILY_CAP,
      }
    },

    call: async (candidate, messages: AIMessage[], opts, apiKey) => {
      const res = await callAI({
        provider: providerFromModel(candidate.model),
        model: candidate.model,
        apiKey,
        messages,
        ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
        ...(opts.maxTokens !== undefined ? { maxTokens: opts.maxTokens } : {}),
        ...(opts.tools ? { tools: opts.tools } : {}),
        ...(opts.responseSchema ? { responseSchema: opts.responseSchema } : {}),
      })
      return {
        text: res.text,
        ...(res.toolCalls?.length ? { toolCalls: res.toolCalls } : {}),
        tokensInput: res.tokensInput,
        tokensOutput: res.tokensOutput,
        ...(res.cacheWriteTokens ? { cacheWriteTokens: res.cacheWriteTokens } : {}),
        ...(res.cacheReadTokens ? { cacheReadTokens: res.cacheReadTokens } : {}),
        latencyMs: res.latencyMs,
      }
    },

    logUsage: async (e) => {
      const info = models.get(e.model)
      const cost = info
        ? (e.tokensInput / 1e6) * info.costInput + (e.tokensOutput / 1e6) * info.costOutput
        : 0
      await admin.from('ai_usage_log').insert({
        space_id: e.spaceId,
        usage_key: e.usageKey,
        provider: e.provider,
        model: e.model,
        is_free: e.isFree,
        fell_back: e.fellBack,
        escalated: e.escalated,
        degraded: e.degraded,
        cache_hit: e.cacheHit,
        attempts: e.attempts,
        tokens_input: e.tokensInput,
        tokens_output: e.tokensOutput,
        cache_write_tokens: e.cacheWriteTokens,
        cache_read_tokens: e.cacheReadTokens,
        cost_usd: cost,
        latency_ms: e.latencyMs,
      })
      // 累計每日額度
      await admin.rpc('increment_ai_quota', {
        p_space_id: e.spaceId,
        p_local_date: localDate,
        p_is_free: e.isFree,
      })
    },

    cacheGet: async (usageKey, space, prompt) => {
      const { data } = await admin
        .from('ai_response_cache')
        .select('response_text, expires_at')
        .eq('usage_key', usageKey)
        .eq('scope', 'space')
        .eq('space_id', space)
        .eq('prompt_hash', hashPrompt(usageKey, space, prompt))
        .eq('context_hash', 'v1')
        .maybeSingle()
      if (!data) return null
      if (new Date(data.expires_at) < new Date()) return null
      return data.response_text
    },

    cacheSet: async (usageKey, space, prompt, text) => {
      const expires = new Date(Date.now() + 24 * 3600 * 1000).toISOString()
      // plain insert：重複 key 觸發 unique 違反 → 被 complete.ts 的 fail-soft 吞掉
      // （快取已有這筆，不必再寫）。避開 coalesce 表達式索引的 onConflict 推斷問題。
      await admin.from('ai_response_cache').insert({
        usage_key: usageKey,
        scope: 'space',
        space_id: space,
        prompt_hash: hashPrompt(usageKey, space, prompt),
        context_hash: 'v1',
        response_text: text,
        expires_at: expires,
      })
    },
  }
}
