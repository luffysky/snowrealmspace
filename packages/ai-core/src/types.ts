import type { ProviderId } from './providers.js'

/**
 * Provider 統一介面型別。見 docs/spec/12-ai-model-routing.md §3.2。
 */

export type AIContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; mediaType: string; data: string } // base64，不含 data: prefix

export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | AIContentBlock[]
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: object // JSON Schema
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface AICompletionRequest {
  provider: ProviderId
  model: string
  apiKey: string
  messages: AIMessage[]
  temperature?: number
  maxTokens?: number
  tools?: ToolDefinition[]
  responseSchema?: object
  /** 呼叫端自己管備援時設 true，避免雙重退避。 */
  noFallback?: boolean
  /** 測試注入；預設用 global fetch。 */
  fetchImpl?: typeof fetch
  /** cloudflare endpoint 需要。 */
  cloudflareAccountId?: string
}

export interface AICompletionResponse {
  text: string
  toolCalls?: ToolCall[]
  tokensInput: number
  tokensOutput: number
  cacheWriteTokens?: number
  cacheReadTokens?: number
  latencyMs: number
  raw?: unknown
}
