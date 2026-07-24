/**
 * @snowrealm/ai-core —— 多模型路由層（ADR-023）。
 * 見 docs/spec/12-ai-model-routing.md。
 *
 * 目前導出的是**純核心邏輯**（已在 AI 島線上驗證、照搬勿重新發明）：
 * usage keys、provider 解析、文字清理/計費、錯誤分類、低信心偵測、
 * circuit breaker、候選鏈排序/升級、快取 key 正規化、預設候選鏈。
 *
 * HTTP 呼叫（callAI/streamAI）、金鑰管理、completeForUsage 主流程、
 * 預算閘門與 DB 寫入是後續層，需要 fetch/DB/金鑰。
 */

export {
  type AiUsageKey,
  AI_USAGE_KEYS,
  UNCACHEABLE_USAGE,
  isCacheable,
} from './usage-keys.js'

export {
  type ProviderId,
  type Protocol,
  PROVIDER_IDS,
  OPENAI_COMPATIBLE,
  protocolFor,
  endpointFor,
  splitProviderPrefix,
  providerFromModel,
  stripLoneSurrogates,
  PROMPT_CACHE_MARKER,
  billableInputTokens,
} from './providers.js'

export {
  QuotaExceededError,
  AllCandidatesFailedError,
  isQuotaOrTransientError,
  REFUSAL_PATTERNS,
  looksLowConfidence,
} from './errors.js'

export {
  CB_COOLDOWN_MS,
  CB_TRIP_THRESHOLD,
  type Clock,
  isProviderTripped,
  markProviderFailure,
  markProviderSuccess,
  _resetBreakers,
} from './circuit-breaker.js'

export {
  type CandidateRole,
  type UsageCandidate,
  providerOf,
  orderCandidates,
  filterAffordable,
  escalateTarget,
} from './candidates.js'

export { normalizeQuestion, SEMANTIC_CACHE_THRESHOLD } from './cache-key.js'

export { DEFAULT_CANDIDATES } from './default-candidates.js'

export {
  type AttemptResult,
  type CandidateOutcome,
  type RunDeps,
  type RunOptions,
  type RunResult,
  runCandidateChain,
} from './router.js'

export {
  type AIContentBlock,
  type AIMessage,
  type ToolDefinition,
  type ToolCall,
  type AICompletionRequest,
  type AICompletionResponse,
} from './types.js'

export { callAI } from './client.js'

export {
  encryptKey,
  decryptKey,
  envKeyName,
  createKeyResolver,
  type KeyResolverDeps,
} from './keys.js'

export {
  type UsageCompletion,
  type ModelCallResult,
  type UsageLogEntry,
  type CompleteDeps,
  type CompleteOptions,
  completeForUsage,
} from './complete.js'

export {
  type StatementCategory,
  type Statement,
  INFERENCE_MAX_CONFIDENCE,
  InvalidStatementError,
  clampStatement,
  clampStatements,
} from './statements.js'
