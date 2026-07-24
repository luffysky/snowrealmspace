import type { NextRequest } from 'next/server'
import { z } from 'zod'
import {
  encryptKey,
  testProviderKey,
  PROVIDER_META,
  type ProviderId,
} from '@snowrealm/ai-core'
import { createAdminClient } from '@snowrealm/db/server'
import { serverEnv } from '@snowrealm/shared-types'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'
import { checkSiteAdmin } from '@/lib/auth/site-admin'

export const dynamic = 'force-dynamic'

const putSchema = z
  .object({
    key: z.string().trim().min(8, '金鑰太短'),
    enabled: z.boolean().default(true),
    monthlyBudgetUsd: z.number().min(0).nullable().optional(),
    test: z.boolean().default(true),
  })
  .strict()

const KNOWN = new Set(PROVIDER_META.map((m) => m.provider))

async function gate() {
  const g = await checkSiteAdmin()
  if (!g.ok) {
    return {
      ok: false as const,
      res:
        g.reason === 'unauthenticated'
          ? fail('UNAUTHENTICATED', '請先登入。')
          : fail('FORBIDDEN', '需要站台管理員身份。'),
    }
  }
  return { ok: true as const }
}

/** 設定/更新某 provider 的金鑰（加密存 DB；預設先測試通過才存）。 */
export const PUT = handler(
  async (request: NextRequest, { params }: { params: Promise<{ provider: string }> }) => {
    const g = await gate()
    if (!g.ok) return g.res
    const { provider } = await params
    if (!KNOWN.has(provider as ProviderId)) return fail('NOT_FOUND', '不支援的 provider。')

    const body: unknown = await request.json().catch(() => null)
    const parsed = putSchema.safeParse(body)
    if (!parsed.success) return failValidation(parsed.error)
    const input = parsed.data

    // 先測試金鑰（預設開啟）—— 不讓一把壞金鑰進 DB
    if (input.test) {
      const result = await testProviderKey(provider as ProviderId, input.key)
      if (!result.ok) {
        return fail('UNPROCESSABLE', `金鑰測試失敗（${result.status ?? '—'}）：${result.body ?? ''}`)
      }
    }

    const encrypted = encryptKey(input.key, serverEnv().AI_KEY_ENCRYPTION_SECRET)
    const admin = createAdminClient()
    const { error } = await admin.from('ai_provider_keys').upsert(
      {
        provider,
        api_key_encrypted: encrypted,
        enabled: input.enabled,
        monthly_budget_usd: input.monthlyBudgetUsd ?? null,
        budget_reset_at: new Date().toISOString().slice(0, 10),
        last_ok_at: input.test ? new Date().toISOString() : null,
        last_error: null,
      },
      { onConflict: 'provider' },
    )
    if (error) {
      console.error('[admin.ai-keys] 儲存失敗', error.message)
      return fail('INTERNAL', '無法儲存金鑰。')
    }
    return ok({ provider, saved: true, tested: input.test })
  },
)

/** 移除某 provider 的金鑰。 */
export const DELETE = handler(
  async (_req: NextRequest, { params }: { params: Promise<{ provider: string }> }) => {
    const g = await gate()
    if (!g.ok) return g.res
    const { provider } = await params

    const admin = createAdminClient()
    const { error } = await admin.from('ai_provider_keys').delete().eq('provider', provider)
    if (error) return fail('INTERNAL', '無法刪除。')
    return ok({ provider, deleted: true })
  },
)
