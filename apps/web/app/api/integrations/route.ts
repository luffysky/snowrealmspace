import { ALL_PROVIDERS } from '@snowrealm/provider-core'
import { resolveContext } from '@/lib/api/context'
import { getFlags } from '@/lib/flags'
import { ok, fail, handler } from '@/lib/api/respond'
import { PROVIDER_FLAG, isConnectable, isProviderKey } from '@/lib/integrations/providers'

export const dynamic = 'force-dynamic'

/**
 * 可用 provider + capability matrix（04-api-contract.md §7）。
 *
 * ADR-018：flag 關閉的 provider **不出現在清單**、其端點也 404。
 * connectable 反映實際憑證是否設定（env 有 client id/secret 才 true），
 * 並附上這個 space 目前的連線狀態與上次同步時間。token 欄位一律不回傳。
 */
export const GET = handler(async () => {
  const result = await resolveContext()
  if (!result.ok) {
    if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
    if (result.reason === 'missing_space') return fail('VALIDATION_FAILED', '缺少 X-Space-Id。')
    return fail('FORBIDDEN', '你沒有這個空間的存取權。')
  }
  const { db, spaceId } = result.ctx

  const flags = await getFlags(spaceId)
  const { data: conns } = await db
    .from('design_connections')
    .select('id, provider, status, last_synced_at, last_error')
    .eq('space_id', spaceId)

  const providers = ALL_PROVIDERS.filter((cap) => isProviderKey(cap.provider))
    .filter((cap) => flags[PROVIDER_FLAG[cap.provider as 'figma' | 'canva']]) // flag 關 → 不列出
    .map((cap) => {
      const provider = cap.provider as 'figma' | 'canva'
      const conn = conns?.find((c) => c.provider === provider) ?? null
      return {
        ...cap,
        connectable: isConnectable(provider),
        featureFlag: PROVIDER_FLAG[provider],
        connection: conn
          ? { id: conn.id, status: conn.status, lastSyncedAt: conn.last_synced_at, lastError: conn.last_error }
          : null,
      }
    })

  return ok({ providers })
})
