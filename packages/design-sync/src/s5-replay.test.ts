import { describe, expect, it } from 'vitest'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CanvaAdapter, FigmaAdapter, hasRecordedFixture, hasRecordedFixtures, replayHttpGet } from '@snowrealm/provider-core'

/**
 * Milestone F sync S5 —— 對「錄製的真實 provider 回應」跑 replay mock 的整合測試。
 *
 * 規格禁手寫理想化 mock：唯一合法的 fixture 來源是首次真憑證＋真檔的端到端實跑錄下來的回應
 * （見 __fixtures__/README.md）。**目前 fixtures 全部缺席**，因此本組測試會**明確 skip 並附原因**，
 * 而不是假通過（CLAUDE.md「不要留假東西」「一個永遠不會失敗的檢查比沒有檢查更糟」）。
 *
 * fixtures 到位後（把 recorded/<provider>/*.json 放進來），同一組測試會自動改跑：
 * 用 replayHttpGet 注入真 adapter，驗證 adapter 的正規化邏輯能吃下真實回應並產出合法形狀。
 */

const here = dirname(fileURLToPath(import.meta.url))
const RECORDED_DIR = join(here, '__fixtures__', 'recorded')

const figmaReady = hasRecordedFixtures(RECORDED_DIR, 'figma')
const canvaReady = hasRecordedFixtures(RECORDED_DIR, 'canva')

describe('S5 — replay mock：真 adapter 跑在錄製的真實回應上', () => {
  const figmaIt = figmaReady ? it : it.skip
  figmaIt(
    figmaReady
      ? 'Figma：adapter 正規化錄製的真實回應'
      : 'S5 Figma：等待首次真憑證實跑的錄製 fixtures（目前不存在 → 略過，見 __fixtures__/README.md）',
    async () => {
      const adapter = new FigmaAdapter(replayHttpGet(RECORDED_DIR))
      if (hasRecordedFixture(RECORDED_DIR, 'figma', 'account')) {
        const acct = await adapter.fetchAccount('replay')
        expect(typeof acct.externalId).toBe('string')
        expect(acct.externalId.length).toBeGreaterThan(0)
      }
      if (hasRecordedFixture(RECORDED_DIR, 'figma', 'list')) {
        const list = await adapter.listFiles('replay', { container: 'replay' })
        expect(Array.isArray(list.files)).toBe(true)
        for (const f of list.files) {
          expect(typeof f.externalId).toBe('string')
          expect(f.externalId.length).toBeGreaterThan(0)
          expect(typeof f.title).toBe('string')
        }
      }
      if (hasRecordedFixture(RECORDED_DIR, 'figma', 'file')) {
        const file = await adapter.fetchFile('replay', 'replay')
        expect(typeof file.externalId).toBe('string')
        expect(typeof file.title).toBe('string')
        if (file.rendition) expect(typeof file.rendition.url).toBe('string')
      }
    },
  )

  const canvaIt = canvaReady ? it : it.skip
  canvaIt(
    canvaReady
      ? 'Canva：adapter 正規化錄製的真實回應'
      : 'S5 Canva：等待首次真憑證實跑的錄製 fixtures（目前不存在 → 略過，見 __fixtures__/README.md）',
    async () => {
      const adapter = new CanvaAdapter(replayHttpGet(RECORDED_DIR))
      if (hasRecordedFixture(RECORDED_DIR, 'canva', 'account')) {
        const acct = await adapter.fetchAccount('replay')
        expect(typeof acct.externalId).toBe('string')
        expect(acct.externalId.length).toBeGreaterThan(0)
      }
      if (hasRecordedFixture(RECORDED_DIR, 'canva', 'list')) {
        const list = await adapter.listFiles('replay')
        expect(Array.isArray(list.files)).toBe(true)
        for (const f of list.files) {
          expect(typeof f.externalId).toBe('string')
          expect(f.externalId.length).toBeGreaterThan(0)
          expect(typeof f.title).toBe('string')
        }
      }
      if (hasRecordedFixture(RECORDED_DIR, 'canva', 'file')) {
        const file = await adapter.fetchFile('replay', 'replay')
        expect(typeof file.externalId).toBe('string')
        expect(typeof file.title).toBe('string')
        if (file.rendition) expect(typeof file.rendition.url).toBe('string')
      }
    },
  )
})
