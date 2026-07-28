import { resolveContext } from '@/lib/api/context'
import { requireFlag } from '@/lib/flags'
import { ok, fail, handler } from '@/lib/api/respond'
import { weatherForCity } from '@/lib/weather/provider'

export const dynamic = 'force-dynamic'

/**
 * 目前天氣（給 WeatherWidget）。Open-Meteo，無需金鑰。
 *
 * 隱私：
 *   - 這個 GET **不收任何城市參數** —— 城市名一律讀該 space 儲存的 weather_city。
 *     避免有人拿它當公開天氣代理，也避免城市/座標出現在我們的 URL/log。
 *   - 只有 space 內成員讀得到（resolveContext → RLS）。
 *   - featureFlag 'weatherWidget' 關閉時整條路由 404（requireFlag，非假關閉）。
 *
 * 回傳分三種狀態，前端誠實呈現：
 *   { enabled:false }                         → 沒開天氣
 *   { enabled:true, configured:false }        → 開了但還沒設城市
 *   { enabled:true, configured:true, ... }    → 有資料
 */
export const GET = handler(async () => {
  const result = await resolveContext()
  if (!result.ok) {
    if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
    return fail('FORBIDDEN', '你沒有這個空間的存取權。')
  }
  const { ctx } = result

  // flag 關閉 → 404（不只是隱藏 widget）
  await requireFlag('weatherWidget', ctx.spaceId)

  const { data: settings } = await ctx.db
    .from('space_settings')
    .select('weather_enabled, weather_city')
    .eq('space_id', ctx.spaceId)
    .maybeSingle()

  if (!settings?.weather_enabled) return ok({ enabled: false })

  const city = settings.weather_city?.trim()
  if (!city) return ok({ enabled: true, configured: false })

  try {
    const now = await weatherForCity(city)
    if (!now) {
      // 城市查無此地：這不是上游壞掉，而是設定的城市找不到 —— 明確告訴使用者
      return ok({ enabled: true, configured: true, found: false, city })
    }
    return ok({
      enabled: true,
      configured: true,
      found: true,
      place: now.place,
      tempC: now.tempC,
      isDay: now.isDay,
      condition: now.condition,
      code: now.code,
    })
  } catch {
    return fail('PROVIDER_ERROR', '天氣服務暫時連不上，稍後再試。')
  }
})
