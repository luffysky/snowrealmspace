import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'
import { gateOwnerConnection } from '@/lib/integrations/connection-gate'
import { ensureAccessToken, syncSelectedFiles } from '@/lib/integrations/sync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 同步使用者明確挑選的檔案（04-api-contract.md §7、§F 驗收）。key = connectionId。
 *
 * externalIds 必填且非空——**沒有「同步全部」的路徑**，符合「禁止預設同步整個 Team」。
 * 逐檔回報結果（partial success），單檔失敗有明確訊息，不靜默。
 */
const bodySchema = z
  .object({
    externalIds: z
      .array(z.string().trim().min(1).max(500))
      .min(1, '請至少挑選一個檔案')
      .max(50, '一次最多同步 50 個檔案'),
  })
  .strict()

export const POST = handler(async (request: NextRequest, { params }: { params: Promise<{ key: string }> }) => {
  const { key } = await params
  const gate = await gateOwnerConnection(key)
  if (!gate.ok) return gate.res

  const body: unknown = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)

  const token = await ensureAccessToken(gate.ctx.db, gate.connection)
  if (!token.ok) return fail('PROVIDER_ERROR', token.error, { provider: gate.provider })

  // 去重挑選清單，避免同一檔重複處理
  const externalIds = [...new Set(parsed.data.externalIds)]
  const results = await syncSelectedFiles(gate.ctx, gate.connection, token.accessToken, externalIds)

  const created = results.filter((r) => r.status === 'created').length
  const updated = results.filter((r) => r.status === 'updated').length
  const failed = results.filter((r) => r.status === 'error').length

  return ok({ results, summary: { created, updated, failed, total: results.length } })
})
