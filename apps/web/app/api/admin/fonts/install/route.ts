import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { fontBySlug } from '@snowrealm/shared-types'
import { enqueue } from '@/lib/api/queue'
import { ok, fail, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

/**
 * 自動安裝一套內建目錄字體 —— 只入列，實際 fetch+子集化+上傳由 **worker** 做。
 *
 * 為什麼移到 worker：中文字體子集化 9 字重 × ~48 分片 × 16MB 原檔要跑數分鐘，
 * 同步 HTTP 會被 Cloudflare 100 秒（524）砍斷。worker 無 HTTP timeout。
 * 這裡 202 快回，前端輪詢「已安裝」列表看結果。
 */
export const POST = handler(async (request: Request) => {
  const gate = await checkSiteAdmin()
  if (!gate.ok) return fail(gate.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '需要站台管理員身份。')

  const body = (await request.json().catch(() => null)) as { slug?: string } | null
  const entry = fontBySlug(String(body?.slug ?? ''))
  if (!entry) return fail('VALIDATION_FAILED', '未知的字體代號。')
  if (entry.source.kind === 'manual') {
    return fail('UNPROCESSABLE', '這套字體沒有自動下載來源（例如台北黑體），請用上傳。')
  }

  // singletonKey：同一套字體重複點不會排成一堆 job
  const id = await enqueue('font.install', { slug: entry.slug }, { singletonKey: `font.install:${entry.slug}` })
  if (!id) return fail('INTERNAL', '無法排入安裝工作（worker 佇列）。')

  return ok({ queued: true, slug: entry.slug }, undefined, 202)
})
