import { describe, expect, it } from 'vitest'
import {
  MAX_SYNC_ATTEMPTS,
  backoffMs,
  isTransientStatus,
  nextDelayMs,
  parseRetryAfterSeconds,
  shouldGiveUp,
} from './retry'

describe('isTransientStatus', () => {
  it('429 / 5xx / 網路0 為暫時性', () => {
    expect(isTransientStatus(429)).toBe(true)
    expect(isTransientStatus(500)).toBe(true)
    expect(isTransientStatus(503)).toBe(true)
    expect(isTransientStatus(0)).toBe(true)
  })
  it('4xx（非 429）為永久性', () => {
    expect(isTransientStatus(400)).toBe(false)
    expect(isTransientStatus(401)).toBe(false)
    expect(isTransientStatus(403)).toBe(false)
    expect(isTransientStatus(404)).toBe(false)
  })
})

describe('backoffMs', () => {
  it('指數成長：base * 2^(attempt-1)', () => {
    expect(backoffMs(1, 1000, 999_999)).toBe(1000)
    expect(backoffMs(2, 1000, 999_999)).toBe(2000)
    expect(backoffMs(3, 1000, 999_999)).toBe(4000)
    expect(backoffMs(4, 1000, 999_999)).toBe(8000)
  })
  it('受 cap 限制', () => {
    expect(backoffMs(10, 1000, 5000)).toBe(5000)
  })
  it('attempt < 1 視為 1', () => {
    expect(backoffMs(0, 1000, 999_999)).toBe(1000)
  })
})

describe('parseRetryAfterSeconds', () => {
  it('純秒數', () => {
    expect(parseRetryAfterSeconds('120')).toBe(120)
    expect(parseRetryAfterSeconds('0')).toBe(0)
  })
  it('HTTP-date（相對 now 計算）', () => {
    const now = Date.parse('2026-01-01T00:00:00Z')
    expect(parseRetryAfterSeconds('Thu, 01 Jan 2026 00:00:30 GMT', now)).toBe(30)
  })
  it('過去時間不為負', () => {
    const now = Date.parse('2026-01-01T00:01:00Z')
    expect(parseRetryAfterSeconds('Thu, 01 Jan 2026 00:00:00 GMT', now)).toBe(0)
  })
  it('空值 / 無法解析 → null', () => {
    expect(parseRetryAfterSeconds(null)).toBeNull()
    expect(parseRetryAfterSeconds(undefined)).toBeNull()
    expect(parseRetryAfterSeconds('')).toBeNull()
    expect(parseRetryAfterSeconds('soon')).toBeNull()
  })
})

describe('nextDelayMs', () => {
  it('有 Retry-After 時優先採用（毫秒）', () => {
    expect(nextDelayMs({ status: 429, attempt: 1, retryAfterSeconds: 90 })).toBe(90_000)
  })
  it('無 Retry-After 時用指數退避', () => {
    expect(nextDelayMs({ status: 503, attempt: 1 })).toBe(30_000)
    expect(nextDelayMs({ status: 503, attempt: 2 })).toBe(60_000)
  })
  it('retryAfterSeconds 為 null 時退回退避', () => {
    expect(nextDelayMs({ status: 500, attempt: 1, retryAfterSeconds: null })).toBe(30_000)
  })
})

describe('shouldGiveUp', () => {
  it('永久性錯誤：立即放棄（不論 attempt）', () => {
    expect(shouldGiveUp(403, 1)).toBe(true)
    expect(shouldGiveUp(404, 1)).toBe(true)
  })
  it('暫時性錯誤：未達上限則續試', () => {
    expect(shouldGiveUp(429, 1)).toBe(false)
    expect(shouldGiveUp(500, 4)).toBe(false)
  })
  it('暫時性錯誤：達上限（第 5 次）即放棄', () => {
    expect(shouldGiveUp(429, MAX_SYNC_ATTEMPTS)).toBe(true)
    expect(shouldGiveUp(500, 5)).toBe(true)
    expect(shouldGiveUp(503, 6)).toBe(true)
  })
})
