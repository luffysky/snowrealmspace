import type { NextRequest } from 'next/server'
import { ProviderApiError, type ProviderFileSummary, type ProviderListOptions } from '@snowrealm/provider-core'
import { ok, fail, handler } from '@/lib/api/respond'
import { gateOwnerConnection } from '@/lib/integrations/connection-gate'
import { ensureAccessToken, getAdapter } from '@/lib/integrations/sync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** provider 檔案摘要 + 本連線的真實同步狀態（design_files.last_synced_at；未同步為 null）。 */
export type IntegrationFile = ProviderFileSummary & { syncedAt: string | null }

/**
 * 列出某條連線可供選擇同步的檔案（04-api-contract.md §7）。key = connectionId。
 * 擁有者限定、flag 關 → 404。**只列舉、不同步**——真正的同步由使用者明確挑選後 POST /sync。
 *
 * 每個檔案再以 design_files.last_synced_at 標註「上次同步」（S4）——用真實資料而非佔位，
 * 依 external_id 對應本連線（RLS 綁定 db）；未曾同步的檔案為 null。
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

    // 標註每個檔案在本連線的真實同步時間（design_files.last_synced_at）
    const { data: syncedRows } = await gate.ctx.db
      .from('design_files')
      .select('external_id, last_synced_at')
      .eq('connection_id', gate.connection.id)
      .is('deleted_at', null)
    const syncedAtByExternalId = new Map<string, string | null>()
    for (const row of syncedRows ?? []) {
      if (row.external_id) syncedAtByExternalId.set(row.external_id, row.last_synced_at)
    }

    const files: IntegrationFile[] = result.files.map((f) => ({
      ...f,
      syncedAt: syncedAtByExternalId.get(f.externalId) ?? null,
    }))
    return ok({ files, nextCursor: result.nextCursor })
  } catch (err) {
    if (err instanceof ProviderApiError) {
      return fail('PROVIDER_ERROR', `無法列出檔案（${err.status}）：${err.message}`, { provider: gate.provider })
    }
    throw err
  }
})
