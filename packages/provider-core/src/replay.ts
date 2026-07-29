import { existsSync, readFileSync } from 'node:fs'
import {
  fixtureKeyForUrl,
  fixturePathFor,
  type FixtureEndpoint,
  type FixtureProvider,
} from './record.js'

/**
 * Milestone F sync S5 —— 以「錄製的真實回應」重播的 provider mock（測試用）。
 *
 * 搭配 ./record.ts：實跑錄下 recorded/<provider>/<endpoint>.json，測試時用 replayHttpGet(dir)
 * 生一個與 provider-core 內部 HTTP seam（ProviderHttpGet）同形狀的函式，注入 FigmaAdapter/CanvaAdapter
 * 的建構子。如此測到的是**真的 adapter 正規化邏輯**跑在**真實錄製回應**上，而非手寫理想化 mock。
 *
 * 找不到 fixture 一律拋 MissingRecordedFixtureError（絕不靜默回假資料）——測試看到就知道
 * 「還沒錄」，該 skip 而不是假通過（見 CLAUDE.md「不要留假東西」）。
 */

/** replay 找不到對應 fixture（尚未實跑錄製，或端點無法辨識）。 */
export class MissingRecordedFixtureError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MissingRecordedFixtureError'
  }
}

/**
 * 生一個從錄製 fixture 重播的 ProviderHttpGet。accessToken 被忽略（重播不打網路）；
 * url 只用來判定端點類型 → 對應 fixture 檔。
 */
export function replayHttpGet(dir: string): (url: string, accessToken: string) => Promise<unknown> {
  return async (url: string) => {
    const key = fixtureKeyForUrl(url)
    if (!key) {
      throw new MissingRecordedFixtureError(`replay 無法辨識這個端點，沒有對應 fixture：${url}`)
    }
    const file = fixturePathFor(dir, key)
    if (!existsSync(file)) {
      throw new MissingRecordedFixtureError(
        `缺少錄製 fixture：${file}（請於首次真憑證實跑時錄製，見 __fixtures__/README.md）`,
      )
    }
    return JSON.parse(readFileSync(file, 'utf8')) as unknown
  }
}

/** 某 provider 的某端點類型是否已有錄製 fixture。 */
export function hasRecordedFixture(dir: string, provider: FixtureProvider, endpoint: FixtureEndpoint): boolean {
  return existsSync(fixturePathFor(dir, { provider, endpoint }))
}

/**
 * 某 provider 是否已有「任一」錄製 fixture（供整組測試決定 skip）。不傳 provider 則兩者任一有即 true。
 * 目前 fixtures 全部缺席 → 回 false → S5 整組測試明確 skip（而非假通過）。
 */
export function hasRecordedFixtures(dir: string, provider?: FixtureProvider): boolean {
  const providers: FixtureProvider[] = provider ? [provider] : ['figma', 'canva']
  const endpoints: FixtureEndpoint[] = ['list', 'file', 'account', 'profile']
  return providers.some((p) => endpoints.some((e) => hasRecordedFixture(dir, p, e)))
}
