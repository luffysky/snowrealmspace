import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

const patchSchema = z
  .object({
    config: z.record(z.unknown()).optional(),
    hidden: z.boolean().optional(),
    locked: z.boolean().optional(),
  })
  .strict()

export const PATCH = handler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const result = await resolveContext()
    if (!result.ok) return fail('UNAUTHENTICATED', '請先登入。')
    const { ctx } = result
    const { id } = await params

    const body: unknown = await request.json().catch(() => null)
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) return failValidation(parsed.error)

    const patch: Record<string, unknown> = {}
    if (parsed.data.config !== undefined) patch['config'] = parsed.data.config
    if (parsed.data.hidden !== undefined) patch['hidden'] = parsed.data.hidden
    if (parsed.data.locked !== undefined) patch['locked'] = parsed.data.locked

    if (Object.keys(patch).length === 0) {
      return fail('VALIDATION_FAILED', '沒有要更新的欄位。')
    }

    const { data, error } = await ctx.db
      .from('widget_instances')
      .update(patch as never)
      .eq('id', id)
      .eq('space_id', ctx.spaceId)
      .select('*')
      .maybeSingle()

    if (error) return fail('INTERNAL', '無法更新。')
    if (!data) return fail('NOT_FOUND', '找不到這個區塊。')
    return ok(data)
  },
)

export const DELETE = handler(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const result = await resolveContext()
    if (!result.ok) return fail('UNAUTHENTICATED', '請先登入。')
    const { ctx } = result
    const { id } = await params

    const { error } = await ctx.db
      .from('widget_instances')
      .delete()
      .eq('id', id)
      .eq('space_id', ctx.spaceId)

    if (error) return fail('INTERNAL', '無法移除。')
    return ok({ id, removed: true })
  },
)
