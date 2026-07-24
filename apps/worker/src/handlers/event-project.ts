import type { Job } from 'pg-boss'
import { createAdminClient } from '@snowrealm/db/server'
import {
  projectRow,
  throttleMinutesFor,
  groupTitleFor,
  type ActivityEventRow,
  type ProjectedTimeline,
} from '@snowrealm/analytics'

/**
 * event.project —— 把 activity_events 投影成 timeline_events（ADR-013）。
 * 見 08-jobs-events.md §1.3。
 *
 * 每輪批次處理 projected_at is null 的事件：
 *   1. 套投影規則（不投影的事件只標記 projected_at，不建 timeline 列）。
 *   2. 節流：同 space、同型別、同時間窗的事件合併成一筆（groupTitle）。
 *   3. 寫入 timeline_events（source_event_id unique → 冪等，重跑不重複）。
 *   4. 標記所有處理過的事件 projected_at（0020 的 trigger 放行此欄位）。
 *
 * 靜默失敗是 bug：投影出錯必須 log，否則 Timeline 會出現無法解釋的空洞。
 */
const BATCH = 200

function windowBucket(occurredAt: string, minutes: number): number {
  return Math.floor(new Date(occurredAt).getTime() / (minutes * 60_000))
}

export async function handleEventProject(_jobs: Job<unknown>[]): Promise<void> {
  const db = createAdminClient()

  const { data: events, error } = await db
    .from('activity_events')
    .select('id, space_id, event_type, entity_type, entity_id, properties, occurred_at')
    .is('projected_at', null)
    .order('occurred_at', { ascending: true })
    .limit(BATCH)

  if (error) {
    console.error('[event.project] 讀取事件失敗', error.message)
    return
  }
  if (!events || events.length === 0) return

  const rows = events as ActivityEventRow[]
  const toInsert: ProjectedTimeline[] = []

  // 節流分組的 key：space_id|event_type|bucket。只對有 throttleMinutes 的規則分組。
  const grouped = new Map<string, { anchor: ProjectedTimeline; count: number; type: string }>()

  for (const row of rows) {
    const projected = projectRow(row)
    if (!projected) continue // 不投影的事件：稍後只標記 projected_at

    const throttle = throttleMinutesFor(row.event_type)
    if (throttle === null) {
      toInsert.push(projected)
      continue
    }

    const key = `${row.space_id}|${row.event_type}|${windowBucket(row.occurred_at, throttle)}`
    const existing = grouped.get(key)
    if (existing) {
      existing.count += 1
    } else {
      grouped.set(key, { anchor: projected, count: 1, type: row.event_type })
    }
  }

  // 每個節流組收斂成一筆（用最早的事件當 anchor，標題視數量變化）
  for (const { anchor, count, type } of grouped.values()) {
    const title = count > 1 ? (groupTitleFor(type, count) ?? anchor.title) : anchor.title
    toInsert.push({ ...anchor, title })
  }

  if (toInsert.length > 0) {
    // source_event_id unique → 冪等；重跑同一批不會產生重複的 timeline 列
    const { error: insErr } = await db
      .from('timeline_events')
      .upsert(toInsert as never, { onConflict: 'source_event_id', ignoreDuplicates: true })
    if (insErr) {
      console.error('[event.project] 寫入 timeline 失敗', insErr.message)
      return // 不標記 projected_at，下輪重試
    }
  }

  // 標記所有這批事件為已投影（含不投影的，避免每輪重掃）
  const now = new Date().toISOString()
  const ids = rows.map((r) => r.id)
  const { error: markErr } = await db
    .from('activity_events')
    .update({ projected_at: now })
    .in('id', ids)
  if (markErr) {
    console.error('[event.project] 標記 projected_at 失敗', markErr.message)
  }

  console.log(`[event.project] 投影 ${toInsert.length} 筆、標記 ${ids.length} 個事件`)
}
