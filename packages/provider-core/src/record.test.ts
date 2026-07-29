import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fixtureKeyForUrl, recordResponse, redactRecorded } from './record.js'
import { MissingRecordedFixtureError, hasRecordedFixture, hasRecordedFixtures, replayHttpGet } from './replay.js'
import { FigmaAdapter } from './index.js'

/**
 * S5 錄製 / 重播「機制」的單元測試。
 *
 * 重要界線：這裡用的都是**明顯合成**的 in-test 資料（{ id: 'test-...' }），寫進**臨時目錄**，
 * 只驗證機制本身（去敏、URL→端點對應、record→replay 往返、錄製 seam 真的會寫檔）。
 * 這**不是**手寫理想化的 provider mock——真正供 sync 測試用的 recorded/ fixture 只能靠首次實跑錄製。
 * 兩者刻意分開（見 __fixtures__/README.md）。
 */

function tmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'sr-s5-'))
}

describe('fixtureKeyForUrl（URL → provider/端點類型）', () => {
  it('Figma：/v1/me → account、projects/:id/files → list、files/:key → file', () => {
    expect(fixtureKeyForUrl('https://api.figma.com/v1/me')).toEqual({ provider: 'figma', endpoint: 'account' })
    expect(fixtureKeyForUrl('https://api.figma.com/v1/projects/P1/files')).toEqual({ provider: 'figma', endpoint: 'list' })
    expect(fixtureKeyForUrl('https://api.figma.com/v1/files/ABC123')).toEqual({ provider: 'figma', endpoint: 'file' })
  })
  it('Canva：designs → list、designs/:id → file、users/me → account、users/me/profile → profile', () => {
    expect(fixtureKeyForUrl('https://api.canva.com/rest/v1/designs?limit=50')).toEqual({ provider: 'canva', endpoint: 'list' })
    expect(fixtureKeyForUrl('https://api.canva.com/rest/v1/designs/DAF1')).toEqual({ provider: 'canva', endpoint: 'file' })
    expect(fixtureKeyForUrl('https://api.canva.com/rest/v1/users/me')).toEqual({ provider: 'canva', endpoint: 'account' })
    expect(fixtureKeyForUrl('https://api.canva.com/rest/v1/users/me/profile')).toEqual({ provider: 'canva', endpoint: 'profile' })
  })
  it('認不得的 host / 路徑 / 非 URL → null（不錄不重播）', () => {
    expect(fixtureKeyForUrl('https://example.com/x')).toBeNull()
    expect(fixtureKeyForUrl('https://api.figma.com/v1/teams/T1')).toBeNull()
    expect(fixtureKeyForUrl('not a url')).toBeNull()
  })
})

describe('redactRecorded（去敏）', () => {
  it('命中去敏 key（token/email/secret…）整個換成 [REDACTED]', () => {
    const out = redactRecorded({ access_token: 'a', refresh_token: 'b', client_secret: 'c', keep: 'ok' }) as Record<string, unknown>
    expect(out.access_token).toBe('[REDACTED]')
    expect(out.refresh_token).toBe('[REDACTED]')
    expect(out.client_secret).toBe('[REDACTED]')
    expect(out.keep).toBe('ok')
  })
  it('email 字串 → [REDACTED_EMAIL]；帶 query 的 URL 去掉 query（常含簽章 token）', () => {
    const out = redactRecorded({ contact: 'nami@example.com', thumb: 'https://cdn.example.com/x.png?sig=SECRET&exp=1' }) as Record<string, string>
    expect(out.contact).toBe('[REDACTED_EMAIL]')
    expect(out.thumb).toBe('https://cdn.example.com/x.png?[REDACTED]')
  })
  it('遞迴進 array / 巢狀物件；非敏感原值保留', () => {
    const out = redactRecorded({ items: [{ id: 'test-1', token: 't' }], n: 3, ok: true }) as {
      items: Array<Record<string, unknown>>
      n: number
      ok: boolean
    }
    expect(out.items[0]?.id).toBe('test-1')
    expect(out.items[0]?.token).toBe('[REDACTED]')
    expect(out.n).toBe(3)
    expect(out.ok).toBe(true)
  })
})

describe('record → replay 往返（合成資料、臨時目錄）', () => {
  it('recordResponse 寫入去敏 fixture，replayHttpGet 讀回同內容', async () => {
    const dir = tmpDir()
    try {
      await recordResponse('ignored', 'https://example.com/nope', { x: 1 }) // 認不得端點 → 不寫
      await recordResponse(dir, 'https://api.figma.com/v1/me', { id: 'test-fig', handle: 'tester', email: 'x@y.co' })

      expect(hasRecordedFixture(dir, 'figma', 'account')).toBe(true)
      expect(hasRecordedFixtures(dir, 'figma')).toBe(true)
      expect(hasRecordedFixtures(dir, 'canva')).toBe(false)

      const replayed = (await replayHttpGet(dir)('https://api.figma.com/v1/me', 'tok')) as Record<string, unknown>
      expect(replayed.id).toBe('test-fig')
      expect(replayed.email).toBe('[REDACTED]') // 'email' 是去敏 key → 整值遮罩（key 命中優先於字串層 email 偵測）
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('缺 fixture / 認不得端點 → 拋 MissingRecordedFixtureError（絕不回假資料）', async () => {
    const dir = tmpDir()
    try {
      await expect(replayHttpGet(dir)('https://api.figma.com/v1/me', 'tok')).rejects.toBeInstanceOf(
        MissingRecordedFixtureError,
      )
      await expect(replayHttpGet(dir)('https://example.com/x', 'tok')).rejects.toBeInstanceOf(
        MissingRecordedFixtureError,
      )
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('錄製 seam（DESIGN_SYNC_RECORD_DIR gate，端到端）', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.DESIGN_SYNC_RECORD_DIR
  })

  it('未設 env → adapter 正常運作，不寫任何 fixture（零副作用）', async () => {
    const dir = tmpDir()
    try {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(JSON.stringify({ id: 'test-1', handle: 'h' }), { status: 200 })),
      )
      const acct = await new FigmaAdapter().fetchAccount('tok')
      expect(acct).toEqual({ externalId: 'test-1', label: 'h' })
      expect(hasRecordedFixtures(dir)).toBe(false) // 沒設 env → 沒錄
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('設 env → adapter 打完 REST 後把去敏回應錄成 fixture（證明 seam 真的會錄）', async () => {
    const dir = tmpDir()
    process.env.DESIGN_SYNC_RECORD_DIR = dir
    try {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(JSON.stringify({ id: 'test-9', handle: 'nami', email: 'n@x.co' }), { status: 200 })),
      )
      const acct = await new FigmaAdapter().fetchAccount('tok')
      expect(acct).toEqual({ externalId: 'test-9', label: 'nami' }) // 正規化仍正確

      const file = join(dir, 'figma', 'account.json')
      const recorded = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
      expect(recorded.id).toBe('test-9')
      expect(recorded.email).toBe('[REDACTED]') // 錄製時去敏（'email' key 命中 → 整值遮罩）
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
