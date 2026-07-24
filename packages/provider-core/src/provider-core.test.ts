import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import {
  FIGMA_CAPABILITIES,
  capabilitiesFor,
  verifyHmacSignature,
  webhookIdempotencyKey,
  FigmaAdapter,
} from './index.js'

describe('capabilities', () => {
  it('Figma 宣告 oauth/webhooks/fileSync/selectiveFiles', () => {
    expect(FIGMA_CAPABILITIES.oauth).toBe(true)
    expect(FIGMA_CAPABILITIES.webhooks).toBe(true)
    expect(FIGMA_CAPABILITIES.selectiveFiles).toBe(true)
  })
  it('Figma connectable=false（尚未設定憑證，前端不給連接按鈕，禁 Coming Soon）', () => {
    expect(FIGMA_CAPABILITIES.connectable).toBe(false)
  })
  it('capabilitiesFor 查得到 figma、查不到未知', () => {
    expect(capabilitiesFor('figma')?.displayName).toBe('Figma')
    expect(capabilitiesFor('canva')).toBeUndefined()
  })
})

describe('verifyHmacSignature', () => {
  const secret = 'whsec_test'
  const body = '{"file_key":"abc","timestamp":"2026-07-24"}'
  const good = createHmac('sha256', secret).update(body, 'utf8').digest('hex')

  it('正確簽章通過', () => {
    expect(verifyHmacSignature(body, good, secret)).toBe(true)
  })
  it('帶 sha256= 前綴也通過', () => {
    expect(verifyHmacSignature(body, `sha256=${good}`, secret)).toBe(true)
  })
  it('錯誤簽章被拒', () => {
    expect(verifyHmacSignature(body, 'deadbeef', secret)).toBe(false)
  })
  it('null 簽章被拒', () => {
    expect(verifyHmacSignature(body, null, secret)).toBe(false)
  })
  it('body 被竄改則失敗', () => {
    expect(verifyHmacSignature(body + 'x', good, secret)).toBe(false)
  })
})

describe('webhook 冪等 + Figma adapter', () => {
  it('冪等 key = provider:eventId', () => {
    expect(webhookIdempotencyKey('figma', 'evt_1')).toBe('figma:evt_1')
  })
  it('FigmaAdapter.externalEventId：有 event_id 用它', () => {
    expect(new FigmaAdapter().externalEventId({ event_id: 'e9' })).toBe('e9')
  })
  it('FigmaAdapter.externalEventId：無 event_id → file_key:timestamp', () => {
    expect(new FigmaAdapter().externalEventId({ file_key: 'fk', timestamp: 't1' })).toBe('fk:t1')
  })
  it('FigmaAdapter.externalEventId：都沒有 → null', () => {
    expect(new FigmaAdapter().externalEventId({})).toBeNull()
  })
})
