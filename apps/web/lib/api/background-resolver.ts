import type { Db } from '@snowrealm/db/server'
import { localHour, localDate, slotForHour, seededIndex, type ScheduleSpec } from '@snowrealm/validation'

/**
 * 解析「現在該顯示哪個背景」。
 *
 * v1.0 §12.7：排程以 **space 時區**計算，不是 UTC，也不是瀏覽器時區。
 * 使用者設定「17:00 換黃昏背景」指的是他所在時區的 17:00。
 */

export type ResolvedBackground = {
  current: Record<string, unknown> | null
  next: Record<string, unknown> | null
  switchAt: string | null
  transition: string
  transitionMs: number
  playMode: string
  intervalSeconds: number
}


export async function resolveCurrentBackground(
  db: Db,
  spaceId: string,
  timeZone: string,
  now = new Date(),
): Promise<ResolvedBackground | null> {
  const { data: playlist } = await db
    .from('background_playlists')
    .select('*')
    .eq('space_id', spaceId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (!playlist) return null

  const { data: items } = await db
    .from('background_playlist_items')
    .select('id, position, background_item_id, background_items(*)')
    .eq('playlist_id', playlist.id)
    .order('position', { ascending: true })

  const entries = (items ?? [])
    .map((row) => ({
      id: row.id,
      position: row.position,
      item: row.background_items as unknown as Record<string, unknown> | null,
    }))
    .filter((e) => e.item !== null && e.item['deleted_at'] === null)

  if (entries.length === 0) return null

  const base = {
    transition: playlist.transition,
    transitionMs: playlist.transition_ms,
    playMode: playlist.play_mode,
    intervalSeconds: playlist.interval_seconds,
  }

  // ── 時段排程 ──
  if (playlist.play_mode === 'time_of_day') {
    const schedule = playlist.schedule as ScheduleSpec
    const hour = localHour(now, timeZone)
    const slot = schedule?.slots ? slotForHour(schedule, hour) : null

    if (slot) {
      const match = entries.find((e) => e.item?.['id'] === slot.backgroundItemId)
      if (match) {
        // 下次切換是這個 slot 的結束時刻
        const switchAt = new Date(now)
        switchAt.setHours(slot.endHour, 0, 0, 0)
        if (switchAt <= now) switchAt.setDate(switchAt.getDate() + 1)

        return {
          ...base,
          current: match.item,
          next: null,
          switchAt: switchAt.toISOString(),
        }
      }
    }
    // 沒有對應的 slot：退回第一張，而不是空白
    return { ...base, current: entries[0]!.item, next: entries[1]?.item ?? null, switchAt: null }
  }

  // ── 每日 / 隨機：以當地日期為種子，同一天內穩定 ──
  if (playlist.play_mode === 'daily' || playlist.play_mode === 'random') {
    const index = seededIndex(`${playlist.id}:${localDate(now, timeZone)}`, entries.length)
    const nextIndex = (index + 1) % entries.length
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)

    return {
      ...base,
      current: entries[index]!.item,
      next: entries[nextIndex]?.item ?? null,
      switchAt: playlist.play_mode === 'daily' ? tomorrow.toISOString() : null,
    }
  }

  // ── 依序 / 每小時 / 其他：由前端依 intervalSeconds 輪播 ──
  return {
    ...base,
    current: entries[0]!.item,
    // v1.0 §12.6：僅預載下一張
    next: entries[1]?.item ?? null,
    switchAt: null,
  }
}
