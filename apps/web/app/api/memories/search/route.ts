import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { toVectorLiteral } from '@snowrealm/ai-core'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'
import { buildCompleteDeps } from '@/lib/ai/deps'
import { embedForUsage } from '@/lib/ai/embed'

export const dynamic = 'force-dynamic'

const searchQuerySchema = z.object({
  q: z.string().trim().min(1, '請輸入查詢字串').max(500),
  limit: z.coerce.number().int().min(1).max(50).optional().default(8),
})

/**
 * 語意檢索：把查詢字串向量化，對 memories.embedding 做餘弦距離排序。
 * RLS：memories 僅 owner 可讀，match_memories 是 security invoker → 沿用同一授權。
 *
 * 降級：沒有可用的 embedding 金鑰時（embedForUsage 回 null），退回關鍵字 ILIKE ——
 * 誠實地給出「能給的最好結果」，而非空手或假裝失敗。
 */
export const GET = handler(async (request: NextRequest) => {
  const result = await resolveContext()
  if (!result.ok) {
    if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
    return fail('FORBIDDEN', '你沒有這個空間的存取權。')
  }
  const { ctx } = result

  const parsed = searchQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) return failValidation(parsed.error)
  const { q, limit } = parsed.data

  const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date())
  const deps = await buildCompleteDeps(ctx.spaceId, localDate, ctx.userId)
  const vector = await embedForUsage(q, deps)

  if (vector) {
    const { data, error } = await ctx.db.rpc('match_memories', {
      p_space_id: ctx.spaceId,
      p_query_embedding: toVectorLiteral(vector),
      p_match_count: limit,
    })
    if (error) {
      console.error('[memories.search] rpc 失敗', error.message)
      return fail('INTERNAL', '語意檢索失敗。')
    }
    return ok({ mode: 'semantic', results: data ?? [] })
  }

  // 降級：關鍵字比對
  const { data, error } = await ctx.db
    .from('memories')
    .select('id, content, sensitivity')
    .eq('space_id', ctx.spaceId)
    .eq('approved', true)
    .neq('sensitivity', 'restricted')
    .is('deleted_at', null)
    .ilike('content', `%${q}%`)
    .limit(limit)
  if (error) {
    console.error('[memories.search] ilike 失敗', error.message)
    return fail('INTERNAL', '檢索失敗。')
  }
  return ok({
    mode: 'keyword',
    results: (data ?? []).map((m) => ({ ...m, similarity: null })),
  })
})
