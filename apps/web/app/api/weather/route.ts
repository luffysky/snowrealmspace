import { resolveContext } from '@/lib/api/context'
import { requireFlag } from '@/lib/flags'
import { ok, fail, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

/**
 * 天氣設定（給 WeatherWidget）。**只回傳該 space 儲存的城市名，本路由不外呼 Open-Meteo。**
 *
 * 為什麼不在伺服器查天氣：
 *   Zeabur 的 gateway 到 Open-Meteo 連線不穩，即使壓短逾時仍會回 502（Bad Gateway）。
 *   瀏覽器反而連得到（Open-Meteo 公開且開放 CORS），故把 geocode+forecast 移到瀏覽器做。
 *   本路由只讀設定 → 立即回應，**502 不可能發生**。
 *
 * 隱私：
 *   - 只回城市名（讀該 space 儲存的 weather_city），不含座標。
 *   - 只有 space 內成員讀得到（resolveContext → RLS）。
 *   - featureFlag 'weatherWidget' 關閉時整條路由 404（requireFlag，非假關閉）。
 *
 * 回傳分三種狀態，前端誠實呈現：
 *   { enabled:false }                          → 沒開天氣
 *   { enabled:true, configured:false }         → 開了但還沒設城市
 *   { enabled:true, configured:true, city }    → 有城市，瀏覽器自己去查天氣
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

  return ok({ enabled: true, configured: true, city })
})
