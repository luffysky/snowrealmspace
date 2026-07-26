import type { NextRequest } from 'next/server'
import { serverEnv } from '@snowrealm/shared-types'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

/**
 * Giphy 代理。金鑰只在伺服器（GIPHY_API_KEY），不進 client bundle。
 *
 * ?q= 有值 → search；空 → trending。回傳精簡後的清單（id / 預覽 gif / 標題），
 * 前端只拿它需要的，不把 giphy 的完整 payload（含追蹤網址）轉給瀏覽器。
 * 需登入（避免變成公開的 giphy 代理被人白嫖流量）。
 */
export const GET = handler(async (request: NextRequest) => {
  const result = await resolveContext()
  if (!result.ok) return fail('UNAUTHENTICATED', '請先登入。')

  const key = serverEnv().GIPHY_API_KEY
  if (!key) return fail('AI_UNAVAILABLE', 'Giphy 尚未設定。', { configured: false })

  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(24, Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 24))

  const base = q
    ? `https://api.giphy.com/v1/gifs/search?q=${encodeURIComponent(q)}`
    : 'https://api.giphy.com/v1/gifs/trending'
  const url = `${base}${q ? '&' : '?'}api_key=${encodeURIComponent(key)}&limit=${limit}&rating=pg-13&bundle=fixed_height_small`

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return fail('PROVIDER_ERROR', 'Giphy 回應失敗。')
    const body = (await res.json()) as { data?: GiphyRaw[] }
    const gifs = (body.data ?? [])
      .map((g) => {
        const img = g.images?.fixed_height_small ?? g.images?.fixed_height
        if (!img?.url) return null
        return {
          id: g.id,
          title: g.title ?? '',
          url: img.url,
          width: Number(img.width) || 0,
          height: Number(img.height) || 0,
        }
      })
      .filter((x): x is GiphyGif => x !== null)
    return ok({ gifs })
  } catch {
    return fail('PROVIDER_ERROR', 'Giphy 連線逾時或失敗。')
  }
})

type GiphyImage = { url?: string; width?: string; height?: string }
type GiphyRaw = {
  id: string
  title?: string
  images?: { fixed_height_small?: GiphyImage; fixed_height?: GiphyImage }
}
type GiphyGif = { id: string; title: string; url: string; width: number; height: number }
