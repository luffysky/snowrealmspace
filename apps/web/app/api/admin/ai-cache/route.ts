import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { createAdminClient } from '@snowrealm/db/server'
import { ok, fail, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

const modeSchema = z.enum(['expired', 'all'])

/**
 * 清除 AI 回應快取（站台管理員）。
 *   mode=expired 只清過期；mode=all 全清。
 * 快取會自動重建，屬安全操作；但全清仍在 UI 要二次確認。
 */
export const DELETE = handler(async (request: NextRequest) => {
  const gate = await checkSiteAdmin()
  if (!gate.ok) {
    return fail(gate.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '需要站台管理員身份。')
  }

  const mode = modeSchema.safeParse(new URL(request.url).searchParams.get('mode'))
  if (!mode.success) return fail('VALIDATION_FAILED', 'mode 必須是 expired 或 all。')

  const admin = createAdminClient()
  const base = admin.from('ai_response_cache').delete({ count: 'exact' })
  // supabase delete 需要 filter；expired 用到期時間，all 用「hit_count >= 0」涵蓋全部。
  const query =
    mode.data === 'expired' ? base.lt('expires_at', new Date().toISOString()) : base.gte('hit_count', 0)

  const { error, count } = await query
  if (error) {
    console.error('[ai-cache] 清除失敗', error.message)
    return fail('INTERNAL', '清除失敗。')
  }
  return ok({ mode: mode.data, removed: count ?? 0 })
})
