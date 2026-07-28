import type { NextRequest } from 'next/server'
import { resolveContext } from '@/lib/api/context'
import { requireFlag } from '@/lib/flags'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'
import { weatherSearchSchema } from '@snowrealm/validation'
import { searchCities } from '@/lib/weather/provider'

export const dynamic = 'force-dynamic'

/**
 * 城市自動完成搜尋（設定頁的城市輸入框用）。
 *
 * 輸入走 **body**（查詢字串不進 URL，避免落到我們的 log），回最多 8 筆建議。
 * 靠 Open-Meteo 的地理編碼：一併涵蓋台灣縣市/區、外島與國外城市，名稱在地化（zh），
 * 不需維護巨大的靜態清單、也不製造 i18n 債。
 *
 * 需登入 + space 成員；同樣受 'weatherWidget' flag 約束（關閉時 404）。
 * 為了 debounce 友善，這裡只做輕量的地理編碼查詢、不查天氣。
 */
export const POST = handler(async (request: NextRequest) => {
  const result = await resolveContext()
  if (!result.ok) {
    if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
    return fail('FORBIDDEN', '你沒有這個空間的存取權。')
  }
  await requireFlag('weatherWidget', result.ctx.spaceId)

  const json = (await request.json().catch(() => null)) as unknown
  const parsed = weatherSearchSchema.safeParse(json)
  if (!parsed.success) return failValidation(parsed.error)

  try {
    const matches = await searchCities(parsed.data.query)
    // 只回前端需要的欄位；座標不外流（隱私：我們也只儲存城市名）。
    const suggestions = matches.map((m) => ({
      name: m.name,
      ...(m.admin1 ? { admin1: m.admin1 } : {}),
      ...(m.country ? { country: m.country } : {}),
      displayName: m.displayName,
    }))
    return ok({ suggestions })
  } catch {
    return fail('PROVIDER_ERROR', '城市搜尋暫時連不上，稍後再試。')
  }
})
