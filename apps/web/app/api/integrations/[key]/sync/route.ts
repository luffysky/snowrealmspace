import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'
import { enqueue } from '@/lib/api/queue'
import { gateOwnerConnection } from '@/lib/integrations/connection-gate'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 同步使用者明確挑選的檔案（04-api-contract.md §7、§F 驗收）。key = connectionId。
 *
 * S2：改為**入列背景 job**（apps/worker 的 design.sync）而非當場同步 —— 背景執行、退避重試、
 * 429 依 Retry-After、連 5 次失敗轉 error + 通知都在 worker。每個檔案入列一個 job，
 * 以 singletonKey `sync:<connectionId>:<externalId>` 去重（同檔短時間重複點不會並發重跑）。
 *
 * externalIds 必填且非空 —— **沒有「同步全部」路徑**，符合「禁止預設同步整個 Team」。
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

  const externalIds = [...new Set(parsed.data.externalIds)]
  const connectionId = gate.connection.id
  const spaceId = gate.ctx.spaceId

  const enqueued: { externalId: string; jobId: string | null }[] = []
  for (const externalId of externalIds) {
    const jobId = await enqueue(
      'design.sync',
      { connectionId, spaceId, externalId, attempt: 1 },
      { singletonKey: `sync:${connectionId}:${externalId}` },
    )
    enqueued.push({ externalId, jobId })
  }

  const accepted = enqueued.filter((e) => e.jobId !== null).length
  // 入列失敗（jobId=null）不靜默：回報受理數，全數失敗直接回錯讓前端能提示重試
  if (accepted === 0) return fail('INTERNAL', '排入同步佇列失敗，請稍後再試。')

  return ok({ enqueued, accepted, total: externalIds.length }, undefined, 202)
})
