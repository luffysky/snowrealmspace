import type { NextRequest } from 'next/server'
import { playlistCreateSchema } from '@snowrealm/validation'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

export const GET = handler(async () => {
  const result = await resolveContext()
  if (!result.ok) {
    if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
    return fail('FORBIDDEN', '你沒有這個空間的存取權。')
  }
  const { ctx } = result

  const { data } = await ctx.db
    .from('background_playlists')
    .select('*, background_playlist_items(id, position, background_item_id)')
    .eq('space_id', ctx.spaceId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  return ok(data ?? [])
})

export const POST = handler(async (request: NextRequest) => {
  const result = await resolveContext()
  if (!result.ok) {
    if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
    return fail('FORBIDDEN', '你沒有這個空間的存取權。')
  }
  const { ctx } = result

  const body: unknown = await request.json().catch(() => null)
  const parsed = playlistCreateSchema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)
  const input = parsed.data

  const { data, error } = await ctx.db
    .from('background_playlists')
    .insert({
      space_id: ctx.spaceId,
      name: input.name,
      play_mode: input.playMode,
      interval_seconds: input.intervalSeconds,
      transition: input.transition,
      transition_ms: input.transitionMs,
      schedule: (input.schedule ?? {}) as never,
    })
    .select('*')
    .single()

  if (error || !data) {
    console.error('[playlists] 建立失敗', error?.message)
    return fail('INTERNAL', '無法建立播放清單。')
  }
  return ok(data, undefined, 201)
})
