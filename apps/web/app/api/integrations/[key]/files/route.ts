import type { NextRequest } from 'next/server'
import { ProviderApiError, type ProviderListOptions } from '@snowrealm/provider-core'
import { ok, fail, handler } from '@/lib/api/respond'
import { gateOwnerConnection } from '@/lib/integrations/connection-gate'
import { ensureAccessToken, getAdapter } from '@/lib/integrations/sync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 列出某條連線可供選擇同步的檔案（04-api-contract.md §7）。key = connectionId。
 * 擁有者限定、flag 關 → 404。**只列舉、不同步**——真正的同步由使用者明確挑選後 POST /sync。
 */
export const GET = handler(async (request: NextRequest, { params }: { params: Promise<{ key: string }> }) => {
  const { key } = await params
  const gate = await gateOwnerConnection(key)
  if (!gate.ok) return gate.res

  const token = await ensureAccessToken(gate.ctx.db, gate.connection)
  if (!token.ok) return fail('PROVIDER_ERROR', token.error, { provider: gate.provider })

  const url = new URL(request.url)
  const opts: ProviderListOptions = {}
  const container = url.searchParams.get('container')
  const cursor = url.searchParams.get('cursor')
  if (container) opts.container = container
  if (cursor) opts.cursor = cursor

  try {
    const result = await getAdapter(gate.provider).listFiles(token.accessToken, opts)
    return ok(result)
  } catch (err) {
    if (err instanceof ProviderApiError) {
      return fail('PROVIDER_ERROR', `無法列出檔案（${err.status}）：${err.message}`, { provider: gate.provider })
    }
    throw err
  }
})
