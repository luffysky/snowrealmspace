import { resolveContext } from '@/lib/api/context'
import { ok, fail, handler } from '@/lib/api/respond'
import { resolveCurrentBackground } from '@/lib/api/background-resolver'

export const dynamic = 'force-dynamic'

/**
 * 現在該顯示哪個背景。
 * v1.0 §12.6：只回傳當前與下一張 —— 前端據此預載，不會一次載入整個清單。
 */
export const GET = handler(async () => {
  const result = await resolveContext()
  if (!result.ok) {
    if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
    return fail('FORBIDDEN', '你沒有這個空間的存取權。')
  }
  const { ctx } = result

  const { data: space } = await ctx.db
    .from('spaces')
    .select('timezone')
    .eq('id', ctx.spaceId)
    .maybeSingle()

  const resolved = await resolveCurrentBackground(
    ctx.db,
    ctx.spaceId,
    space?.timezone ?? 'Asia/Taipei',
  )

  // 沒有啟用中的清單不是錯誤 —— 使用者可能就是不想要背景
  if (!resolved) return ok({ current: null, next: null })

  return ok(resolved)
})
