import { afterEach, describe, expect, it, vi } from 'vitest'
import { searchCities } from './index.js'

/** 用一個回傳指定 JSON 的 Response 假造 fetch。 */
function mockFetchOnce(payload: unknown, ok = true, status = 200) {
  const fn = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  } as unknown as Response)
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('searchCities', () => {
  it('少於 2 字直接回空陣列、不打上游', async () => {
    const fetchFn = mockFetchOnce({ results: [] })
    expect(await searchCities('a')).toEqual([])
    expect(await searchCities(' ')).toEqual([])
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('把結果映射成含 displayName 的建議（最多帶行政區/國家）', async () => {
    mockFetchOnce({
      results: [
        { name: '信義區', latitude: 25.03, longitude: 121.57, admin1: '臺北市', country: '臺灣' },
        { name: 'Tokyo', latitude: 35.68, longitude: 139.75, country: '日本' },
      ],
    })
    const out = await searchCities('台北')
    expect(out).toHaveLength(2)
    expect(out[0]).toMatchObject({ name: '信義區', admin1: '臺北市', country: '臺灣' })
    expect(out[0]?.displayName).toContain('信義區')
    expect(out[1]).toMatchObject({ name: 'Tokyo', country: '日本' })
    expect(out[1]?.displayName).toContain('Tokyo')
  })

  it('用 count=8 與 language=zh 查詢（query 經 encode）', async () => {
    const fetchFn = mockFetchOnce({ results: [] })
    await searchCities('澎湖')
    const url = String(fetchFn.mock.calls[0]?.[0])
    expect(url).toContain('count=8')
    expect(url).toContain('language=zh')
    expect(url).toContain(encodeURIComponent('澎湖'))
  })

  it('查無結果回空陣列（非錯誤）', async () => {
    mockFetchOnce({})
    expect(await searchCities('zzzznowhere')).toEqual([])
  })

  it('上游非 2xx 會 throw（由呼叫端轉成 PROVIDER_ERROR）', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockFetchOnce({ error: true }, false, 500)
    await expect(searchCities('台北')).rejects.toThrow(/search 500/)
  })
})
