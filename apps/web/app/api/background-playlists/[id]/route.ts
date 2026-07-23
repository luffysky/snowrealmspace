import type { NextRequest } from 'next/server'
import { playlistPatchSchema } from '@snowrealm/validation'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

export const PATCH = handler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const result = await resolveContext()
    if (!result.ok) return fail('UNAUTHENTICATED', '請先登入。')
    const { ctx } = result
    const { id } = await params

    const body: unknown = await request.json().catch(() => null)
    const parsed = playlistPatchSchema.safeParse(body)
    if (!parsed.success) return failValidation(parsed.error)
    const input = parsed.data

    const patch: Record<string, unknown> = {}
    if (input.name !== undefined) patch['name'] = input.name
    if (input.playMode !== undefined) patch['play_mode'] = input.playMode
    if (input.intervalSeconds !== undefined) patch['interval_seconds'] = input.intervalSeconds
    if (input.transition !== undefined) patch['transition'] = input.transition
    if (input.transitionMs !== undefined) patch['transition_ms'] = input.transitionMs
    if (input.schedule !== undefined) patch['schedule'] = input.schedule

    if (Object.keys(patch).length === 0) {
      return fail('VALIDATION_FAILED', '沒有要更新的欄位。')
    }

    const { data, error } = await ctx.db
      .from('background_playlists')
      .update(patch as never)
      .eq('id', id)
      .eq('space_id', ctx.spaceId)
      .is('deleted_at', null)
      .select('*')
      .maybeSingle()

    if (error) return fail('INTERNAL', '無法更新播放清單。')
    if (!data) return fail('NOT_FOUND', '找不到這個播放清單。')
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
      .from('background_playlists')
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq('id', id)
      .eq('space_id', ctx.spaceId)

    if (error) return fail('INTERNAL', '無法刪除播放清單。')
    return ok({ id, deleted: true })
  },
)
