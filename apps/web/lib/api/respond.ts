import { NextResponse } from 'next/server'
import { z } from 'zod'

/**
 * 統一回應格式。見 docs/spec/04-api-contract.md §0。
 *
 * 錯誤訊息一律 zh-TW 且對使用者有意義。
 * **禁止把原始 exception message 回傳給前端** —— 那會洩漏內部結構。
 */

export type ApiErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'INSUFFICIENT_ROLE'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'HAS_REFERENCES'
  | 'QUOTA_EXCEEDED'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'UNPROCESSABLE'
  | 'RATE_LIMITED'
  | 'AI_QUOTA_EXCEEDED'
  | 'PROVIDER_ERROR'
  | 'AI_UNAVAILABLE'
  | 'INTERNAL'

const STATUS: Record<ApiErrorCode, number> = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  INSUFFICIENT_ROLE: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  HAS_REFERENCES: 409,
  QUOTA_EXCEEDED: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  UNPROCESSABLE: 422,
  RATE_LIMITED: 429,
  AI_QUOTA_EXCEEDED: 429,
  PROVIDER_ERROR: 502,
  AI_UNAVAILABLE: 503,
  INTERNAL: 500,
}

let requestCounter = 0
function requestId(): string {
  requestCounter = (requestCounter + 1) % 1_000_000
  return `req_${Date.now().toString(36)}_${requestCounter.toString(36)}`
}

export function ok<T>(data: T, meta?: Record<string, unknown>, status = 200) {
  return NextResponse.json(meta ? { data, meta } : { data }, { status })
}

export function fail(
  code: ApiErrorCode,
  message: string,
  details?: Record<string, unknown>,
  headers?: Record<string, string>,
) {
  return NextResponse.json(
    { error: { code, message, ...(details ? { details } : {}), requestId: requestId() } },
    { status: STATUS[code], ...(headers ? { headers } : {}) },
  )
}

/** zod 錯誤 → 400 + fieldErrors（04-api-contract.md 要求 details.fieldErrors 必填）。 */
export function failValidation(error: z.ZodError) {
  const fieldErrors: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_'
    ;(fieldErrors[key] ??= []).push(issue.message)
  }
  return fail('VALIDATION_FAILED', '輸入格式不正確。', { fieldErrors })
}

/**
 * 包住 route handler，把未預期的例外轉成 500。
 * 原始訊息只進伺服器 log，不回傳給前端。
 */
export function handler<T extends unknown[]>(
  fn: (...args: T) => Promise<Response>,
): (...args: T) => Promise<Response> {
  return async (...args: T) => {
    try {
      return await fn(...args)
    } catch (err) {
      console.error('[api] 未預期的錯誤', err)
      return fail('INTERNAL', '伺服器發生問題，請稍後再試。')
    }
  }
}
