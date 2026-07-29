import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'
import { isDecorationId } from '@/lib/decorations'

export const dynamic = 'force-dynamic'

// 每個 space 的裝飾上限：避免無限堆疊拖垮 overlay 效能，也擋惡意灌入。
const MAX_PER_SPACE = 80

// 建立：只需 decorationId + 落點；其餘外觀屬性走預設，之後用 PATCH 微調。
// x/y 是視窗比例，收到超界值就夾回 0..1（不報錯，讓「拖到邊緣」也能存）。
const createSchema = z.object({
  decorationId: z.string().refine(isDecorationId, '未知的裝飾品。'),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
})

export const GET = handler(async () => {
  const result = await resolveContext()
  if (!result.ok) {
    if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
    return fail('FORBIDDEN', '你沒有這個空間的存取權。')
  }
  const { ctx } = result

  const { data, error } = await ctx.db
    .from('space_decorations')
    .select('*')
    .eq('space_id', ctx.spaceId)
    .order('z_index', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(MAX_PER_SPACE)

  if (error) {
    console.error('[decorations] 查詢失敗', error.message)
    return fail('INTERNAL', '無法載入裝飾品。')
  }
  return ok(data ?? [])
})

export const POST = handler(async (request: NextRequest) => {
  const result = await resolveContext()
  if (!result.ok) {
    if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
    return fail('FORBIDDEN', '你沒有這個空間的存取權。')
  }
  const { ctx } = result

  const body: unknown = await request.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)
  const input = parsed.data

  // 上限檢查：RLS 讓 count 只算得到自己 space 的列。
  const { count, error: countError } = await ctx.db
    .from('space_decorations')
    .select('id', { count: 'exact', head: true })
    .eq('space_id', ctx.spaceId)
  if (countError) {
    console.error('[decorations] 計數失敗', countError.message)
    return fail('INTERNAL', '無法加入裝飾品。')
  }
  if ((count ?? 0) >= MAX_PER_SPACE) {
    return fail('QUOTA_EXCEEDED', `裝飾品最多 ${MAX_PER_SPACE} 個，先移除一些再加。`)
  }

  const { data, error } = await ctx.db
    .from('space_decorations')
    .insert({
      space_id: ctx.spaceId,
      decoration_id: input.decorationId,
      x: input.x,
      y: input.y,
    })
    .select('*')
    .single()

  if (error || !data) {
    console.error('[decorations] 建立失敗', error?.message)
    return fail('INTERNAL', '無法加入裝飾品。')
  }
  return ok(data, undefined, 201)
})
