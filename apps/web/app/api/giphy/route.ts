import type { NextRequest } from 'next/server'
import { resolveUser } from '@/lib/api/context'
import { ok, fail, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

/** 兩種命名都收：伺服器端 GIPHY_API_KEY，或 AI 島慣用的 NEXT_PUBLIC_GIPHY_API_KEY（server 端也讀得到）。 */
function giphyKey(): string | undefined {
  return process.env['GIPHY_API_KEY'] || process.env['NEXT_PUBLIC_GIPHY_API_KEY'] || undefined
}

/**
 * Giphy 代理。金鑰只在伺服器（GIPHY_API_KEY），不進 client bundle。
 *
 * ?q= 有值 → search；空 → trending。回傳精簡後的清單（id / 預覽 gif / 標題），
 * 前端只拿它需要的，不把 giphy 的完整 payload（含追蹤網址）轉給瀏覽器。
 * 需登入（避免變成公開的 giphy 代理被人白嫖流量）。
 */
export const GET = handler(async (request: NextRequest) => {
  // Giphy 只需要「已登入」，不需要 space 脈絡 —— 用 resolveUser（不必帶 x-space-id）
  const user = await resolveUser()
  if (!user) return fail('UNAUTHENTICATED', '請先登入。')

  const key = giphyKey()
  if (!key) return fail('AI_UNAVAILABLE', 'Giphy 尚未設定。', { configured: false })

  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(24, Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 24))
  const offset = Math.max(0, Number(request.nextUrl.searchParams.get('offset')) || 0)

  const base = q
    ? `https://api.giphy.com/v1/gifs/search?q=${encodeURIComponent(q)}`
    : 'https://api.giphy.com/v1/gifs/trending'
  const url = `${base}${q ? '&' : '?'}api_key=${encodeURIComponent(key)}&limit=${limit}&offset=${offset}&rating=pg-13&bundle=fixed_height_small`

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) {
      // 把真正的原因說出來（靜默失敗是 bug）——最常見是金鑰無效（401/403）
      const detail = await res.text().catch(() => '')
      console.error('[giphy] 上游回應失敗', res.status, detail.slice(0, 200))
      const msg =
        res.status === 401 || res.status === 403
          ? 'Giphy 金鑰無效或未啟用（請確認 web 服務的 GIPHY_API_KEY 正確、且已重新部署）。'
          : `Giphy 回應失敗（${res.status}）。`
      return fail('PROVIDER_ERROR', msg)
    }
    const body = (await res.json()) as { data?: GiphyRaw[]; pagination?: { total_count?: number } }
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
    const total = body.pagination?.total_count ?? 0
    return ok({ gifs, hasMore: offset + limit < total })
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
