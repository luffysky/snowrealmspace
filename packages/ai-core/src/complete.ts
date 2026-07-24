import type { AiUsageKey } from './usage-keys.js'
import { isCacheable } from './usage-keys.js'
import type { ProviderId } from './providers.js'
import { providerFromModel, splitProviderPrefix } from './providers.js'
import type { UsageCandidate } from './candidates.js'
import { providerOf } from './candidates.js'
import { runCandidateChain, type AttemptResult } from './router.js'
import { QuotaExceededError } from './errors.js'
import type { Clock } from './circuit-breaker.js'
import type { AIMessage, ToolCall, ToolDefinition } from './types.js'

/**
 * completeForUsage —— 路由主流程（§4.5）。
 *
 * DB 相關的一切（候選鏈、金鑰、預算、快取、用量記錄）都以 deps 注入，
 * 讓主流程可完整 mock 測試（不需真金鑰/DB）。web/worker 端建 deps 時
 * 用受 service role 的 Supabase 與 keys.ts 填進來。
 */

export type UsageCompletion = {
  text: string
  toolCalls?: ToolCall[]
  model: string
  provider: ProviderId
  isFree: boolean
  fellBack: boolean
  escalated: boolean
  attempts: number
  degraded: boolean
  cacheHit: 'exact' | 'semantic' | null
}

export type ModelCallResult = {
  text: string
  toolCalls?: ToolCall[]
  tokensInput: number
  tokensOutput: number
  cacheWriteTokens?: number
  cacheReadTokens?: number
  latencyMs: number
}

export type UsageLogEntry = {
  spaceId: string
  usageKey: AiUsageKey
  provider: ProviderId
  model: string
  isFree: boolean
  fellBack: boolean
  escalated: boolean
  degraded: boolean
  cacheHit: 'exact' | 'semantic' | null
  attempts: number
  tokensInput: number
  tokensOutput: number
  cacheWriteTokens: number
  cacheReadTokens: number
  latencyMs: number
}

export type CompleteDeps = {
  getCandidates: (usageKey: AiUsageKey) => Promise<UsageCandidate[]>
  getKey: (provider: ProviderId) => Promise<string | null>
  isFree: (model: string) => boolean
  /** 回傳這個 space 的額度狀態（§4.5 步驟 1）。 */
  budget: (spaceId: string) => Promise<{ freeExhausted: boolean; paidExhausted: boolean }>
  /** 呼叫模型（包 callAI）。 */
  call: (
    candidate: UsageCandidate,
    messages: AIMessage[],
    opts: { maxTokens?: number; temperature?: number; tools?: ToolDefinition[]; responseSchema?: object },
    apiKey: string,
  ) => Promise<ModelCallResult>
  logUsage: (entry: UsageLogEntry) => Promise<void>
  /** 可選：結構化輸出驗證（回 false → 視同低信心觸發升級，§4.4）。 */
  validateSchema?: (text: string, schema: object) => boolean
  cacheGet?: (usageKey: AiUsageKey, spaceId: string, prompt: string) => Promise<string | null>
  cacheSet?: (usageKey: AiUsageKey, spaceId: string, prompt: string, text: string) => Promise<void>
  clock?: Clock
}

export type CompleteOptions = {
  spaceId: string
  system?: string
  user: string | AIMessage[]
  maxTokens?: number
  temperature?: number
  tools?: ToolDefinition[]
  responseSchema?: object
  forceEscalate?: boolean
}

function buildMessages(opts: CompleteOptions): AIMessage[] {
  const messages: AIMessage[] = []
  if (opts.system) messages.push({ role: 'system', content: opts.system })
  if (typeof opts.user === 'string') messages.push({ role: 'user', content: opts.user })
  else messages.push(...opts.user)
  return messages
}

/** 單輪（無對話歷史）才可走快取（§5.1）。 */
function isSingleTurn(opts: CompleteOptions): boolean {
  if (typeof opts.user === 'string') return true
  const nonSystem = opts.user.filter((m) => m.role !== 'system')
  return nonSystem.length <= 1
}

function promptKeyText(opts: CompleteOptions): string {
  if (typeof opts.user === 'string') return opts.user
  return opts.user
    .map((m) => (typeof m.content === 'string' ? m.content : ''))
    .join('\n')
}

export async function completeForUsage(
  usageKey: AiUsageKey,
  opts: CompleteOptions,
  deps: CompleteDeps,
): Promise<UsageCompletion> {
  // 1. 預算閘門（§4.5 步驟 1）
  const budget = await deps.budget(opts.spaceId)
  if (budget.freeExhausted) {
    throw new QuotaExceededError('今日免費額度已用盡，明日 00:00 重置')
  }

  // 2. 快取查詢（§5）—— 僅單輪、可快取用途
  const cacheable = isCacheable(usageKey) && isSingleTurn(opts)
  if (cacheable && deps.cacheGet) {
    const hit = await deps.cacheGet(usageKey, opts.spaceId, promptKeyText(opts)).catch(() => null)
    if (hit !== null) {
      return {
        text: hit,
        model: 'cache',
        provider: 'anthropic',
        isFree: true,
        fellBack: false,
        escalated: false,
        attempts: 0,
        degraded: false,
        cacheHit: 'exact',
      }
    }
  }

  // 3. 候選鏈
  const chain = await deps.getCandidates(usageKey)
  const messages = buildMessages(opts)

  // key 快取：同一次呼叫多個候選共用查詢結果
  const keyCache = new Map<ProviderId, string | null>()
  const getKeyCached = async (provider: ProviderId): Promise<string | null> => {
    if (!keyCache.has(provider)) keyCache.set(provider, await deps.getKey(provider))
    return keyCache.get(provider) ?? null
  }

  // runCandidateChain 需要同步的 hasKey；先預載所有候選的 key 狀態
  const providers = Array.from(new Set(chain.map((c) => providerOf(c) as ProviderId)))
  await Promise.all(providers.map((p) => getKeyCached(p)))

  let lastCall: ModelCallResult | null = null

  const run = await runCandidateChain(
    chain,
    {
      hasKey: (c) => Boolean(keyCache.get(providerOf(c) as ProviderId)),
      isFree: deps.isFree,
      ...(deps.clock ? { clock: deps.clock } : {}),
      attempt: async (c): Promise<AttemptResult> => {
        const apiKey = keyCache.get(providerOf(c) as ProviderId) ?? ''
        const { model } = splitProviderPrefix(c.model)
        const callOpts: { maxTokens?: number; temperature?: number; tools?: ToolDefinition[]; responseSchema?: object } = {}
        if (opts.maxTokens !== undefined) callOpts.maxTokens = opts.maxTokens
        if (opts.temperature !== undefined) callOpts.temperature = opts.temperature
        if (opts.tools) callOpts.tools = opts.tools
        if (opts.responseSchema) callOpts.responseSchema = opts.responseSchema
        const res = await deps.call({ ...c, model }, messages, callOpts, apiKey)
        lastCall = res
        const schemaValid =
          opts.responseSchema && deps.validateSchema
            ? deps.validateSchema(res.text, opts.responseSchema)
            : undefined
        return {
          text: res.text,
          ...(res.toolCalls?.length ? { toolCalls: res.toolCalls } : {}),
          ...(schemaValid !== undefined ? { schemaValid } : {}),
        }
      },
    },
    {
      ...(opts.forceEscalate !== undefined ? { forceEscalate: opts.forceEscalate } : {}),
      paidBudgetExhausted: budget.paidExhausted,
      hasSchema: Boolean(opts.responseSchema),
    },
  )

  const provider = providerOf(run.candidate) as ProviderId
  const isFree = deps.isFree(run.candidate.model)
  const call = lastCall as ModelCallResult | null

  const completion: UsageCompletion = {
    text: run.result.text,
    ...(run.result.toolCalls?.length ? { toolCalls: run.result.toolCalls as ToolCall[] } : {}),
    model: run.candidate.model,
    provider,
    isFree,
    fellBack: run.fellBack,
    escalated: run.escalated,
    attempts: run.attempts,
    degraded: run.degraded,
    cacheHit: null,
  }

  // 8. 記錄用量 + 寫快取（fail-soft）
  await deps
    .logUsage({
      spaceId: opts.spaceId,
      usageKey,
      provider,
      model: run.candidate.model,
      isFree,
      fellBack: run.fellBack,
      escalated: run.escalated,
      degraded: run.degraded,
      cacheHit: null,
      attempts: run.attempts,
      tokensInput: call?.tokensInput ?? 0,
      tokensOutput: call?.tokensOutput ?? 0,
      cacheWriteTokens: call?.cacheWriteTokens ?? 0,
      cacheReadTokens: call?.cacheReadTokens ?? 0,
      latencyMs: call?.latencyMs ?? 0,
    })
    .catch(() => {})

  if (cacheable && deps.cacheSet && completion.text) {
    await deps.cacheSet(usageKey, opts.spaceId, promptKeyText(opts), completion.text).catch(() => {})
  }

  return completion
}

export { providerFromModel }
