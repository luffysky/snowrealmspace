import { PROVIDER_META } from '@snowrealm/ai-core'
import { createAdminClient } from '@snowrealm/db/server'
import { ok, fail, handler } from '@/lib/api/respond'
import { checkSiteAdmin } from '@/lib/auth/site-admin'

export const dynamic = 'force-dynamic'

/**
 * 列出所有 provider 的金鑰狀態（站台管理員）。
 * 金鑰本身不回傳（加密存 DB），只回「有沒有設、啟用否、上次是否成功」。
 */
export const GET = handler(async () => {
  const gate = await checkSiteAdmin()
  if (!gate.ok) {
    return gate.reason === 'unauthenticated'
      ? fail('UNAUTHENTICATED', '請先登入。')
      : fail('FORBIDDEN', '需要站台管理員身份。')
  }

  const admin = createAdminClient()
  const { data: rows } = await admin
    .from('ai_provider_keys')
    .select('provider, enabled, last_ok_at, last_error, monthly_budget_usd, used_this_month_usd')

  const byProvider = new Map((rows ?? []).map((r) => [r.provider, r]))

  const providers = PROVIDER_META.map((m) => {
    const row = byProvider.get(m.provider)
    return {
      provider: m.provider,
      label: m.label,
      url: m.url,
      placeholder: m.placeholder,
      hint: m.hint,
      free: m.free,
      hasKey: Boolean(row),
      enabled: row?.enabled ?? false,
      lastOkAt: row?.last_ok_at ?? null,
      lastError: row?.last_error ?? null,
    }
  })

  return ok({ providers, adminSignals: gate.signals })
})
