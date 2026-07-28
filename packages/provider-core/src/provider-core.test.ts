import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import {
  FIGMA_CAPABILITIES,
  ADOBE_CAPABILITIES,
  capabilitiesFor,
  verifyHmacSignature,
  verifyFigmaPasscode,
  webhookIdempotencyKey,
  FigmaAdapter,
  CanvaAdapter,
  AdobeAdapter,
  ProviderApiError,
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
  it('capabilitiesFor 查得到 figma/canva/adobe、查不到未實作', () => {
    expect(capabilitiesFor('figma')?.displayName).toBe('Figma')
    expect(capabilitiesFor('canva')?.displayName).toBe('Canva')
    expect(capabilitiesFor('canva')?.connectable).toBe(false)
    expect(capabilitiesFor('adobe')?.displayName).toBe('Adobe')
    expect(capabilitiesFor('photoshop')).toBeUndefined()
  })
  it('Adobe connectable=false（尚未設定憑證＋OAuth 待校正，前端不給連接按鈕，禁 Coming Soon）', () => {
    expect(ADOBE_CAPABILITIES.connectable).toBe(false)
    expect(ADOBE_CAPABILITIES.webhooks).toBe(false) // 範圍待確認，保守關閉
    expect(ADOBE_CAPABILITIES.selectiveFiles).toBe(true)
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

describe('verifyFigmaPasscode', () => {
  const secret = 'my-random-passcode'
  it('body 的 passcode 相符 → 通過', () => {
    expect(verifyFigmaPasscode({ passcode: secret, file_key: 'abc' }, secret)).toBe(true)
  })
  it('passcode 不符 → 拒絕', () => {
    expect(verifyFigmaPasscode({ passcode: 'wrong' }, secret)).toBe(false)
  })
  it('缺 passcode → 拒絕', () => {
    expect(verifyFigmaPasscode({ file_key: 'abc' }, secret)).toBe(false)
  })
  it('secret 未設定（空字串）→ 一律拒絕（不驗＝不信）', () => {
    expect(verifyFigmaPasscode({ passcode: '' }, '')).toBe(false)
  })
  it('passcode 非字串 → 拒絕', () => {
    expect(verifyFigmaPasscode({ passcode: 12345 }, secret)).toBe(false)
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

describe('affectedFileExternalIds', () => {
  it('Figma：有 file_key → [file_key]', () => {
    expect(new FigmaAdapter().affectedFileExternalIds({ file_key: 'fk1' })).toEqual(['fk1'])
  })
  it('Figma：無 file_key → []', () => {
    expect(new FigmaAdapter().affectedFileExternalIds({ event_id: 'e1' })).toEqual([])
  })
  it('Figma：file_key 非字串 → []', () => {
    expect(new FigmaAdapter().affectedFileExternalIds({ file_key: 123 })).toEqual([])
  })

  it('Canva：design.id → [id]', () => {
    expect(new CanvaAdapter().affectedFileExternalIds({ design: { id: 'd1' } })).toEqual(['d1'])
  })
  it('Canva：data.design.id → [id]', () => {
    expect(new CanvaAdapter().affectedFileExternalIds({ data: { design: { id: 'd2' } } })).toEqual(['d2'])
  })
  it('Canva：頂層 id → [id]', () => {
    expect(new CanvaAdapter().affectedFileExternalIds({ id: 'd3' })).toEqual(['d3'])
  })
  it('Canva：都沒有 → []', () => {
    expect(new CanvaAdapter().affectedFileExternalIds({ foo: 'bar' })).toEqual([])
  })
  it('Canva：id 非字串 → []', () => {
    expect(new CanvaAdapter().affectedFileExternalIds({ id: 999 })).toEqual([])
  })

  it('Adobe：asset.id → [id]', () => {
    expect(new AdobeAdapter().affectedFileExternalIds({ asset: { id: 'a1' } })).toEqual(['a1'])
  })
  it('Adobe：data.asset.id → [id]', () => {
    expect(new AdobeAdapter().affectedFileExternalIds({ data: { asset: { id: 'a2' } } })).toEqual(['a2'])
  })
  it('Adobe：頂層 id → [id]', () => {
    expect(new AdobeAdapter().affectedFileExternalIds({ id: 'a3' })).toEqual(['a3'])
  })
  it('Adobe：都沒有 → []', () => {
    expect(new AdobeAdapter().affectedFileExternalIds({ foo: 'bar' })).toEqual([])
  })
  it('Adobe：id 非字串 → []', () => {
    expect(new AdobeAdapter().affectedFileExternalIds({ id: 999 })).toEqual([])
  })
})

describe('AdobeAdapter（誠實佔位：未校正前不臆造 sync）', () => {
  it('externalEventId：有 event_id 用它', () => {
    expect(new AdobeAdapter().externalEventId({ event_id: 'e1' })).toBe('e1')
  })
  it('externalEventId：退回 id', () => {
    expect(new AdobeAdapter().externalEventId({ id: 'e2' })).toBe('e2')
  })
  it('externalEventId：都沒有 → null', () => {
    expect(new AdobeAdapter().externalEventId({ foo: 'bar' })).toBeNull()
  })
  it('verifyWebhook：一律 false（TODO(adobe) 未校正 → 不信任）', () => {
    expect(new AdobeAdapter().verifyWebhook('{}', 'sig', 'secret')).toBe(false)
  })
  it('listFiles：拋 ProviderApiError（尚未實作，不假成功）', async () => {
    await expect(new AdobeAdapter().listFiles('tok')).rejects.toBeInstanceOf(ProviderApiError)
  })
  it('fetchFile：拋 ProviderApiError（尚未實作，不假成功）', async () => {
    await expect(new AdobeAdapter().fetchFile('tok', 'ext')).rejects.toBeInstanceOf(ProviderApiError)
  })
})
