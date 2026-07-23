import type { NextRequest } from 'next/server'
import { emitEvent } from '@snowrealm/analytics'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

/**
 * 啟用播放清單。
 * 一個 space 同時只有一個 active（0010_backgrounds.sql 的 unique index 保證）。
 */
export const POST = handler(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const result = await resolveContext()
    if (!result.ok) return fail('UNAUTHENTICATED', '請先登入。')
    const { ctx } = result
    const { id } = await params

    const { data: playlist } = await ctx.db
      .from('background_playlists')
      .select('id')
      .eq('id', id)
      .eq('space_id', ctx.spaceId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!playlist) return fail('NOT_FOUND', '找不到這個播放清單。')

    const { count } = await ctx.db
      .from('background_playlist_items')
      .select('*', { count: 'exact', head: true })
      .eq('playlist_id', id)

    if (!count) {
      return fail('UNPROCESSABLE', '這個播放清單還沒有任何背景，無法啟用。')
    }

    // 先停用其他的，再啟用這個 —— unique index 不允許同時兩個 active
    await ctx.db
      .from('background_playlists')
      .update({ is_active: false })
      .eq('space_id', ctx.spaceId)
      .neq('id', id)

    const { error } = await ctx.db
      .from('background_playlists')
      .update({ is_active: true })
      .eq('id', id)
      .eq('space_id', ctx.spaceId)

    if (error) {
      console.error('[playlists] 啟用失敗', error.message)
      return fail('INTERNAL', '無法啟用播放清單。')
    }

    await ctx.db.from('spaces').update({ active_playlist_id: id }).eq('id', ctx.spaceId)

    await emitEvent('playlist.started', ctx.spaceId, ctx.userId, {
      playlistId: id,
      itemCount: count,
    })

    return ok({ playlistId: id, active: true })
  },
)
