import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { createAdminClient } from '@snowrealm/db/server'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

const patchSchema = z
  .object({
    contentId: z.string().min(1).max(120),
    enabled: z.boolean(),
  })
  .strict()

/** 內容池審核：啟用／停用單則文案（content_items，站台管理員）。 */
export const PATCH = handler(async (request: NextRequest) => {
  const gate = await checkSiteAdmin()
  if (!gate.ok) {
    return fail(gate.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '需要站台管理員身份。')
  }

  const body: unknown = await request.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('content_items')
    .update({ enabled: parsed.data.enabled } as never)
    .eq('content_id', parsed.data.contentId)
    .select('content_id')
    .maybeSingle()
  if (error) {
    console.error('[content] 更新失敗', error.message)
    return fail('INTERNAL', '更新失敗。')
  }
  if (!data) return fail('NOT_FOUND', '找不到這則內容。')
  return ok({ contentId: parsed.data.contentId, enabled: parsed.data.enabled })
})
