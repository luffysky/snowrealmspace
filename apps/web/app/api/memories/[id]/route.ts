import type { NextRequest } from 'next/server'
import { memoryPatchSchema, type MemorySensitivity } from '@snowrealm/validation'
import { emitEvent } from '@snowrealm/analytics'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

const COLUMNS = 'id, type, content, source_type, sensitivity, approved, created_at, updated_at'

export const PATCH = handler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const result = await resolveContext()
    if (!result.ok) {
      if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
      return fail('FORBIDDEN', '你沒有這個空間的存取權。')
    }
    const { ctx } = result
    const { id } = await params

    const body: unknown = await request.json().catch(() => null)
    const parsed = memoryPatchSchema.safeParse(body)
    if (!parsed.success) return failValidation(parsed.error)
    const input = parsed.data

    type Update = { content?: string; sensitivity?: MemorySensitivity }
    const patch: Update = {}
    if (input.content !== undefined) patch.content = input.content
    if (input.sensitivity !== undefined) patch.sensitivity = input.sensitivity

    const { data, error } = await ctx.db
      .from('memories')
      .update(patch)
      .eq('id', id)
      .eq('space_id', ctx.spaceId)
      .is('deleted_at', null)
      .select(COLUMNS)
      .maybeSingle()

    if (error) return fail('INTERNAL', '無法更新記憶。')
    if (!data) return fail('NOT_FOUND', '找不到這則記憶，或你沒有權限。')
    return ok(data)
  },
)

/** 軟刪除單一記憶。 */
export const DELETE = handler(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const result = await resolveContext()
    if (!result.ok) {
      if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
      return fail('FORBIDDEN', '你沒有這個空間的存取權。')
    }
    const { ctx } = result
    const { id } = await params

    const { data, error } = await ctx.db
      .from('memories')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('space_id', ctx.spaceId)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle()

    if (error) return fail('INTERNAL', '無法刪除記憶。')
    if (!data) return fail('NOT_FOUND', '找不到這則記憶，或你沒有權限。')

    await emitEvent('memory.deleted', ctx.spaceId, ctx.userId, {
      memoryId: data.id,
      bulk: false,
    }).catch(() => {})
    return ok({ id: data.id, deleted: true })
  },
)
