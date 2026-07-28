/**
 * IP → 大致地區（國家 / 省州 / 城市）查詢。**只回傳地區字串，永不回傳或保存原始 IP。**
 *
 * 移植自 AI 島 track route 的 geo() 思路，適配本專案：
 *   1. 優先用邊緣平台 headers（Cloudflare / Vercel 直連、最快最準、免外呼）
 *   2. 沒有 city 時才打外部 IP 定位服務，fallback chain：
 *      ipapi.co → ip-api.com → ipwho.is（各 ~3s timeout）
 *   3. 24h in-memory Map 快取（同 IP 不重複外呼，省額度、防 rate limit）
 *
 * 誠實原則：全部失敗就回 `{}`（log 一行，不拋錯）——上游照樣寫入 session，
 * 只是地區欄位留空，而不是讓 heartbeat 整個爆掉。
 *
 * 只在 Node runtime 使用（用到 fetch 外呼）。
 */

export type GeoResult = {
  country?: string
  region?: string
  city?: string
}

type CacheEntry = { value: GeoResult; ts: number }

const GEO_TTL = 24 * 3600 * 1000
const GEO_CACHE_MAX = 5000
// 以 IP 為 key 的短期記憶體快取。IP 只當快取 key 用於「本進程生命週期內」，
// 不落地、不外傳、不寫 DB；進程重啟即消失。
const geoCache = new Map<string, CacheEntry>()

/** 讀邊緣平台注入的地區 header（Cloudflare / Vercel）。 */
function geoFromHeaders(headers: Headers): GeoResult {
  const country =
    headers.get('cf-ipcountry') || headers.get('x-vercel-ip-country') || undefined
  const region =
    headers.get('cf-region') || headers.get('x-vercel-ip-country-region') || undefined
  const city = headers.get('cf-ipcity') || headers.get('x-vercel-ip-city') || undefined
  const out: GeoResult = {}
  // CF 對本機/未知會回 'XX' 或 'T1'（Tor）；當作無值
  if (country && country !== 'XX' && country !== 'T1') out.country = country
  if (region) out.region = decodeSafe(region)
  if (city) out.city = decodeSafe(city)
  return out
}

/** 部分平台會把 city/region 做 URL 編碼（含空白 / 非 ASCII）。 */
function decodeSafe(v: string): string {
  try {
    return decodeURIComponent(v)
  } catch {
    return v
  }
}

function isLocalOrEmpty(ip: string | null | undefined): boolean {
  if (!ip) return true
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.startsWith('::1') ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('172.16.') ||
    ip === 'localhost'
  )
}

async function fetchJson(url: string, timeoutMs = 3000): Promise<unknown | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'snowrealm-space' } })
    if (!res.ok) return null
    return (await res.json()) as unknown
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** 外部 IP 定位 fallback chain。全失敗回 null。 */
async function lookupByIp(ip: string): Promise<GeoResult | null> {
  // 1. ipapi.co（https 免 key、最細到城市；免費 1000/天）
  const a = (await fetchJson(`https://ipapi.co/${encodeURIComponent(ip)}/json/`)) as
    | { error?: unknown; country_code?: string; region?: string; city?: string }
    | null
  if (a && !a.error && a.city) {
    return clean({ country: a.country_code, region: a.region, city: a.city })
  }

  // 2. ip-api.com（免費 45 req/min、含 regionName 縣市；免費版 http only）
  const b = (await fetchJson(
    `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,countryCode,regionName,city`,
  )) as { status?: string; countryCode?: string; regionName?: string; city?: string } | null
  if (b && b.status === 'success') {
    return clean({ country: b.countryCode, region: b.regionName, city: b.city })
  }

  // 3. ipwho.is（免費 ~10k/月、不需 key、IPv4/v6）
  const c = (await fetchJson(`https://ipwho.is/${encodeURIComponent(ip)}`)) as
    | { success?: boolean; country_code?: string; region?: string; city?: string }
    | null
  if (c && c.success) {
    return clean({ country: c.country_code, region: c.region, city: c.city })
  }

  return null
}

/** 去掉空字串 / undefined，只留有值的欄位。 */
function clean(r: {
  country?: string | null | undefined
  region?: string | null | undefined
  city?: string | null | undefined
}): GeoResult {
  const out: GeoResult = {}
  if (r.country) out.country = r.country
  if (r.region) out.region = r.region
  if (r.city) out.city = r.city
  return out
}

/**
 * 主要進入點。傳入請求 headers 與（暫時用的）client IP。
 * **回傳只含地區字串；原始 IP 只在本函式內當快取 key 與外呼參數，用完即棄、絕不外流或落地。**
 */
export async function lookupGeo(headers: Headers, ip: string | null | undefined): Promise<GeoResult> {
  const fromHeaders = geoFromHeaders(headers)
  // 邊緣 header 已給到城市層級 → 直接用，完全不外呼、不碰 IP
  if (fromHeaders.city) return fromHeaders

  // 本機 / 內網 IP 查不到有意義地區 → 有 header 的國家就回、否則空
  if (isLocalOrEmpty(ip)) return fromHeaders

  const key = ip as string
  const cached = geoCache.get(key)
  if (cached && Date.now() - cached.ts < GEO_TTL) {
    // header 的國家優先（比 IP 猜的準），其餘用快取
    return { ...cached.value, ...(fromHeaders.country ? { country: fromHeaders.country } : {}) }
  }

  const fresh = await lookupByIp(key)
  if (fresh) {
    // 簡易上限：超過就 evict 最舊的一筆
    if (geoCache.size >= GEO_CACHE_MAX) {
      const firstKey = geoCache.keys().next().value
      if (firstKey !== undefined) geoCache.delete(firstKey)
    }
    geoCache.set(key, { value: fresh, ts: Date.now() })
    return { ...fresh, ...(fromHeaders.country ? { country: fromHeaders.country } : {}) }
  }

  // 全部失敗：誠實回報（log 一行不拋錯），並快取空結果避免短期重打
  console.warn('[geo] 所有 IP 定位服務都查不到，地區留空')
  geoCache.set(key, { value: fromHeaders, ts: Date.now() })
  return fromHeaders
}
