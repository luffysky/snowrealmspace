import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { createAdminClient } from '@snowrealm/db/server'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

const postSchema = z
  .object({ pattern: z.string().min(1).max(200), description: z.string().max(200).optional() })
  .strict()
const patchSchema = z.object({ id: z.string().uuid(), enabled: z.boolean() }).strict()

async function gateOrFail() {
  const gate = await checkSiteAdmin()
  if (!gate.ok) {
    return {
      res: fail(gate.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '需要站台管理員身份。'),
    }
  }
  return { gate }
}

/** 新增一條附加安全字樣。pattern 必須是有效正則。 */
export const POST = handler(async (request: NextRequest) => {
  const g = await gateOrFail()
  if ('res' in g) return g.res

  const body: unknown = await request.json().catch(() => null)
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)

  // 伺服器端也驗證能編譯，避免存進一條壞正則
  try {
    new RegExp(parsed.data.pattern)
  } catch {
    return fail('UNPROCESSABLE', '這不是有效的正則表示式。')
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('content_filter_patterns')
    .insert({
      pattern: parsed.data.pattern,
      description: parsed.data.description ?? null,
      created_by: g.gate.userId,
    } as never)
    .select('id, pattern, description, enabled')
    .single()
  if (error || !data) {
    console.error('[content-filters] 新增失敗', error?.message)
    return fail('INTERNAL', '新增失敗。')
  }
  return ok(data, undefined, 201)
})

/** 啟用／停用。 */
export const PATCH = handler(async (request: NextRequest) => {
  const g = await gateOrFail()
  if ('res' in g) return g.res

  const body: unknown = await request.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('content_filter_patterns')
    .update({ enabled: parsed.data.enabled } as never)
    .eq('id', parsed.data.id)
    .select('id')
    .maybeSingle()
  if (error) return fail('INTERNAL', '更新失敗。')
  if (!data) return fail('NOT_FOUND', '找不到這條規則。')
  return ok({ id: parsed.data.id, enabled: parsed.data.enabled })
})

/** 刪除。 */
export const DELETE = handler(async (request: NextRequest) => {
  const g = await gateOrFail()
  if ('res' in g) return g.res

  const id = z.string().uuid().safeParse(new URL(request.url).searchParams.get('id'))
  if (!id.success) return fail('VALIDATION_FAILED', 'id 不正確。')

  const admin = createAdminClient()
  const { error } = await admin.from('content_filter_patterns').delete().eq('id', id.data)
  if (error) return fail('INTERNAL', '刪除失敗。')
  return ok({ id: id.data, deleted: true })
})
