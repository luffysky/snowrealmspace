import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { AI_USAGE_KEYS } from '@snowrealm/ai-core'
import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { createAdminClient } from '@snowrealm/db/server'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

const candidateSchema = z.object({
  model: z.string().min(1).max(120),
  role: z.enum(['primary', 'fallback', 'escalate']),
})

const usageKeyEnum = z.enum(AI_USAGE_KEYS as unknown as [string, ...string[]])

const patchSchema = z
  .object({
    usageKey: usageKeyEnum,
    candidates: z.array(candidateSchema).min(1).max(12),
    enabled: z.boolean(),
  })
  .strict()

/** 建立／更新某用途的候選鏈覆寫（ai_usage_models，站台管理員維護）。 */
export const PATCH = handler(async (request: NextRequest) => {
  const gate = await checkSiteAdmin()
  if (!gate.ok) {
    return fail(gate.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '需要站台管理員身份。')
  }

  const body: unknown = await request.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)
  const { usageKey, candidates, enabled } = parsed.data

  // 主模型 = 第一個 primary，沒有就取第一個
  const primary = candidates.find((c) => c.role === 'primary') ?? candidates[0]!

  const admin = createAdminClient()
  const { error } = await admin
    .from('ai_usage_models')
    .upsert(
      {
        usage_key: usageKey,
        model_name: primary.model,
        candidates,
        enabled,
        updated_at: new Date().toISOString(),
        updated_by: gate.userId,
      } as never,
      { onConflict: 'usage_key' },
    )
  if (error) {
    console.error('[ai-candidates] 更新失敗', error.message)
    return fail('INTERNAL', '更新失敗。')
  }
  return ok({ usageKey, enabled })
})

/** 移除覆寫 → 該用途回到內建預設鏈（DEFAULT_CANDIDATES）。 */
export const DELETE = handler(async (request: NextRequest) => {
  const gate = await checkSiteAdmin()
  if (!gate.ok) {
    return fail(gate.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '需要站台管理員身份。')
  }

  const usageKey = usageKeyEnum.safeParse(new URL(request.url).searchParams.get('usageKey'))
  if (!usageKey.success) return fail('VALIDATION_FAILED', 'usageKey 不正確。')

  const admin = createAdminClient()
  const { error } = await admin.from('ai_usage_models').delete().eq('usage_key', usageKey.data)
  if (error) {
    console.error('[ai-candidates] 重設失敗', error.message)
    return fail('INTERNAL', '重設失敗。')
  }
  return ok({ usageKey: usageKey.data, reset: true })
})
