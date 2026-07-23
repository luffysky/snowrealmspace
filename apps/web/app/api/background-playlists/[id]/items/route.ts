import type { NextRequest } from 'next/server'
import { playlistItemsSchema, reorderSchema } from '@snowrealm/validation'
import { createAdminClient } from '@snowrealm/db/server'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

/** 加入項目。position 接續在現有項目之後。 */
export const POST = handler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const result = await resolveContext()
    if (!result.ok) return fail('UNAUTHENTICATED', '請先登入。')
    const { ctx } = result
    const { id } = await params

    const body: unknown = await request.json().catch(() => null)
    const parsed = playlistItemsSchema.safeParse(body)
    if (!parsed.success) return failValidation(parsed.error)

    const { data: playlist } = await ctx.db
      .from('background_playlists')
      .select('id')
      .eq('id', id)
      .eq('space_id', ctx.spaceId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!playlist) return fail('NOT_FOUND', '找不到這個播放清單。')

    const { data: existing } = await ctx.db
      .from('background_playlist_items')
      .select('position')
      .eq('playlist_id', id)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle()

    let next = (existing?.position ?? -1) + 1

    const rows = parsed.data.backgroundItemIds.map((backgroundItemId) => ({
      playlist_id: id,
      space_id: ctx.spaceId,
      background_item_id: backgroundItemId,
      position: next++,
    }))

    // 重複加入同一個背景時忽略（unique playlist_id + background_item_id）
    const { error } = await ctx.db
      .from('background_playlist_items')
      .upsert(rows, { onConflict: 'playlist_id,background_item_id', ignoreDuplicates: true })

    if (error) {
      console.error('[playlist-items] 新增失敗', error.message)
      return fail('INTERNAL', '無法加入播放清單。')
    }

    return ok({ added: rows.length })
  },
)

/**
 * 重新排序。
 *
 * 必須在單一 transaction 內完成 —— 拖曳重排時會短暫出現重複 position，
 * 靠 deferrable unique constraint 延到 commit 才檢查（0010_backgrounds.sql）。
 * supabase-js 沒有 transaction API，所以走 RPC。
 */
export const PATCH = handler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const result = await resolveContext()
    if (!result.ok) return fail('UNAUTHENTICATED', '請先登入。')
    const { ctx } = result
    const { id } = await params

    const body: unknown = await request.json().catch(() => null)
    const parsed = reorderSchema.safeParse(body)
    if (!parsed.success) return failValidation(parsed.error)

    const { data: playlist } = await ctx.db
      .from('background_playlists')
      .select('id')
      .eq('id', id)
      .eq('space_id', ctx.spaceId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!playlist) return fail('NOT_FOUND', '找不到這個播放清單。')

    const { error } = await createAdminClient().rpc('reorder_playlist_items', {
      target_playlist_id: id,
      ordered_ids: parsed.data.orderedItemIds,
    })

    if (error) {
      console.error('[playlist-items] 重排失敗', error.message)
      return fail('INTERNAL', '無法重新排序。')
    }

    return ok({ reordered: parsed.data.orderedItemIds.length })
  },
)

export const DELETE = handler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const result = await resolveContext()
    if (!result.ok) return fail('UNAUTHENTICATED', '請先登入。')
    const { ctx } = result
    const { id } = await params

    const itemId = request.nextUrl.searchParams.get('itemId')
    if (!itemId) return fail('VALIDATION_FAILED', '缺少要移除的項目。')

    const { error } = await ctx.db
      .from('background_playlist_items')
      .delete()
      .eq('id', itemId)
      .eq('playlist_id', id)
      .eq('space_id', ctx.spaceId)

    if (error) return fail('INTERNAL', '無法移除項目。')
    return ok({ removed: itemId })
  },
)
