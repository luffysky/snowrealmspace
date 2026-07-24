import { ALL_PROVIDERS } from '@snowrealm/provider-core'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

/**
 * 可用 provider + capability matrix（04-api-contract.md §7）。
 * 前端據此顯示：connectable=false 的只說「即將支援」，不給連接按鈕（禁永久 Coming Soon）。
 */
export const GET = handler(async () => {
  const result = await resolveContext()
  if (!result.ok) {
    if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
    return fail('FORBIDDEN', '你沒有這個空間的存取權。')
  }
  return ok({ providers: ALL_PROVIDERS })
})
