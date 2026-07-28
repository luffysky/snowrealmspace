import type { NextRequest } from 'next/server'
import { resolveContext } from '@/lib/api/context'
import { requireFlag } from '@/lib/flags'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'
import { weatherLookupSchema } from '@snowrealm/validation'
import { geocodeCity, reverseGeocode, weatherForCity, weatherForCoords } from '@/lib/weather/provider'

export const dynamic = 'force-dynamic'

/**
 * 天氣查詢（設定頁用）。
 *
 * 兩種用途，輸入一律走 **body**（座標/城市不進 URL，避免落到我們的 log）：
 *   - { city } → 驗證城市是否找得到、順便回目前天氣（存檔前預覽）。
 *   - { lat, lon } → 把瀏覽器定位換成可儲存的城市名（reverseGeocode）+ 目前天氣。
 *
 * 需登入 + space 成員；同樣受 'weatherWidget' flag 約束（關閉時 404）。
 */
export const POST = handler(async (request: NextRequest) => {
  const result = await resolveContext()
  if (!result.ok) {
    if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
    return fail('FORBIDDEN', '你沒有這個空間的存取權。')
  }
  await requireFlag('weatherWidget', result.ctx.spaceId)

  const json = (await request.json().catch(() => null)) as unknown
  const parsed = weatherLookupSchema.safeParse(json)
  if (!parsed.success) return failValidation(parsed.error)
  const input = parsed.data

  try {
    // 座標路徑：反查城市名（供存檔）+ 目前天氣
    if (input.lat !== undefined && input.lon !== undefined) {
      const [name, now] = await Promise.all([
        reverseGeocode(input.lat, input.lon),
        weatherForCoords(input.lat, input.lon),
      ])
      if (!name) return ok({ found: false })
      return ok({
        found: true,
        city: name,
        place: name,
        tempC: now.tempC,
        condition: now.condition,
        isDay: now.isDay,
      })
    }

    // 城市路徑：驗證找得到 + 預覽天氣
    const city = input.city!.trim()
    const place = await geocodeCity(city)
    if (!place) return ok({ found: false })
    const now = await weatherForCity(city)
    return ok({
      found: true,
      city,
      place: now?.place ?? place.name,
      ...(now ? { tempC: now.tempC, condition: now.condition, isDay: now.isDay } : {}),
    })
  } catch {
    return fail('PROVIDER_ERROR', '天氣服務暫時連不上，稍後再試。')
  }
})
