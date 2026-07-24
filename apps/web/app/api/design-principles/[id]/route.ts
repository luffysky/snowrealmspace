import type { NextRequest } from 'next/server'
import { principlePatchSchema } from '@snowrealm/validation'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

const COLUMNS = 'id, title, body, category, position, created_at, updated_at'

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
    const parsed = principlePatchSchema.safeParse(body)
    if (!parsed.success) return failValidation(parsed.error)
    const input = parsed.data

    type Update = { title?: string; body?: string | null; category?: string | null }
    const patch: Update = {}
    if (input.title !== undefined) patch.title = input.title
    if (input.body !== undefined) patch.body = input.body
    if (input.category !== undefined) patch.category = input.category

    const { data, error } = await ctx.db
      .from('design_principles')
      .update(patch)
      .eq('id', id)
      .eq('space_id', ctx.spaceId)
      .is('deleted_at', null)
      .select(COLUMNS)
      .maybeSingle()

    if (error) return fail('INTERNAL', '無法更新。')
    if (!data) return fail('NOT_FOUND', '找不到這則設計原則。')
    return ok(data)
  },
)

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
      .from('design_principles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('space_id', ctx.spaceId)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle()

    if (error) return fail('INTERNAL', '無法刪除。')
    if (!data) return fail('NOT_FOUND', '找不到這則設計原則。')
    return ok({ id: data.id, deleted: true })
  },
)
