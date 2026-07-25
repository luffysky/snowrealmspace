import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { createAdminClient } from '@snowrealm/db/server'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

const patchSchema = z
  .object({
    freeDailyCap: z.number().int().min(0).max(100_000),
    paidDailyCap: z.number().int().min(0).max(100_000),
  })
  .strict()

/** 更新全域 AI 每日額度上限（ai_quota_config，站台管理員維護）。 */
export const PATCH = handler(async (request: NextRequest) => {
  const gate = await checkSiteAdmin()
  if (!gate.ok) {
    return fail(gate.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '需要站台管理員身份。')
  }

  const body: unknown = await request.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)

  const admin = createAdminClient()
  const { error } = await admin
    .from('ai_quota_config')
    .update({
      free_daily_cap: parsed.data.freeDailyCap,
      paid_daily_cap: parsed.data.paidDailyCap,
      updated_at: new Date().toISOString(),
      updated_by: gate.userId,
    } as never)
    .eq('id', 'global')
  if (error) {
    console.error('[ai-quota-config] 更新失敗', error.message)
    return fail('INTERNAL', '更新失敗。')
  }
  return ok({ freeDailyCap: parsed.data.freeDailyCap, paidDailyCap: parsed.data.paidDailyCap })
})
