import type { Job } from 'pg-boss'
import { createAdminClient } from '@snowrealm/db/server'
import { storage } from '@snowrealm/storage'

/**
 * 維護類工作。見 08-jobs-events.md §2.5、§4。
 *
 * 這兩支都必須「永不靜默失敗」：它們是在沒有人看的時候跑的，
 * 出問題卻沒有紀錄，等於問題不存在直到災難發生。
 */

/** 各 job 型別的逾時上限（分鐘）。超過即視為卡住。 */
const TIMEOUT_MINUTES: Record<string, number> = {
  'asset.process': 5,
  'asset.analyze_local': 3,
  'asset.purge': 10,
  ping: 1,
}
const DEFAULT_TIMEOUT_MINUTES = 15

/**
 * 檢查卡住的 job。
 *
 * worker 在寫入 DB 後、標記完成前崩潰，job_records 會永遠停在 running。
 * 沒有這個檢查，使用者會看到「處理中…」直到天荒地老。
 */
export async function handleQueueHealth(_jobs: Job<unknown>[]): Promise<void> {
  const db = createAdminClient()

  const { data: running } = await db
    .from('job_records')
    .select('id, type, started_at, space_id')
    .eq('status', 'running')

  const now = Date.now()
  let stuck = 0

  for (const job of running ?? []) {
    if (!job.started_at) continue
    const limit = (TIMEOUT_MINUTES[job.type] ?? DEFAULT_TIMEOUT_MINUTES) * 60_000
    if (now - new Date(job.started_at).getTime() <= limit) continue

    await db
      .from('job_records')
      .update({
        status: 'failed',
        last_error: `超過 ${TIMEOUT_MINUTES[job.type] ?? DEFAULT_TIMEOUT_MINUTES} 分鐘未完成，判定為卡住`,
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id)

    stuck++
    console.error('[queue-health] 卡住的 job', { id: job.id, type: job.type })
  }

  const { count: queued } = await db
    .from('job_records')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued')

  if (stuck > 0 || (queued ?? 0) > 50) {
    console.warn(`[queue-health] 卡住 ${stuck} 個，排隊中 ${queued ?? 0} 個`)
  }
}

/**
 * 儲存空間清理。08-jobs-events.md §4。
 *
 * 刪除順序永遠是 **R2 先、DB 後**：
 * 反過來的話 storage_key 會永遠找不回來，R2 上的檔案變成無法追蹤的孤兒且持續計費。
 * R2 刪成功但 DB 失敗只要重跑即可（刪除不存在的物件是冪等的）。
 */
export async function handleStorageGc(_jobs: Job<unknown>[]): Promise<void> {
  const db = createAdminClient()
  const store = storage()

  // ── 1. 逾期未完成的上傳（24 小時）──
  const staleBefore = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: stale } = await db
    .from('assets')
    .select('id, storage_key')
    .eq('status', 'pending')
    .lt('created_at', staleBefore)
    .limit(500)

  for (const asset of stale ?? []) {
    await store.delete(asset.storage_key).catch((err: unknown) => {
      console.error('[storage-gc] 刪除逾期上傳失敗', asset.id, err)
    })
    await db.from('assets').delete().eq('id', asset.id)
  }

  // ── 2. 軟刪除滿 30 天的 asset ──
  const purgeBefore = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: purgeable } = await db
    .from('assets')
    .select('id, storage_key')
    .not('deleted_at', 'is', null)
    .lt('deleted_at', purgeBefore)
    .limit(200)

  let purged = 0
  for (const asset of purgeable ?? []) {
    const { data: renditions } = await db
      .from('asset_renditions')
      .select('storage_key')
      .eq('asset_id', asset.id)

    const keys = [asset.storage_key, ...(renditions ?? []).map((r) => r.storage_key)]
    const { failed } = await store.deleteMany(keys)

    if (failed.length > 0) {
      // 有檔案沒刪成功就先不刪資料列，下次再試 —— 否則 key 就永遠遺失了
      console.error('[storage-gc] 部分物件刪除失敗，保留資料列', asset.id, failed)
      continue
    }

    await db.from('assets').delete().eq('id', asset.id)
    purged++
  }

  // ── 3. 過期的邀請 ──
  await db
    .from('space_invites')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .is('accepted_at', null)

  if ((stale?.length ?? 0) > 0 || purged > 0) {
    console.log(`[storage-gc] 清理逾期上傳 ${stale?.length ?? 0}、永久刪除 ${purged}`)
  }
}

/** 刪除 space 的寬限期（天）。軟刪除滿這麼久才永久清除，期間可還原。 */
export const SPACE_PURGE_GRACE_DAYS = 7

/**
 * 永久清除已軟刪除滿寬限期的 space。10-acceptance.md 隱私與刪除。
 *
 * 刪除順序 **R2 先、DB 後**（與 storage-gc 同理）：
 * 先刪掉這個 space 所有 asset 與 rendition 的 R2 物件，全部成功後才 hard-delete
 * space 資料列——外鍵 on delete cascade 會連帶清掉 members / assets / backgrounds…
 * 若有任何 R2 物件沒刪成功就保留資料列，下次再試（刪除不存在的物件是冪等的），
 * 絕不讓 storage_key 隨 DB 一起消失、變成永遠計費的孤兒。
 */
export async function handleSpacePurge(_jobs: Job<unknown>[]): Promise<void> {
  const db = createAdminClient()
  const store = storage()

  const purgeBefore = new Date(
    Date.now() - SPACE_PURGE_GRACE_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString()

  const { data: spaces } = await db
    .from('spaces')
    .select('id, name')
    .not('deleted_at', 'is', null)
    .lt('deleted_at', purgeBefore)
    .limit(20)

  let purged = 0

  for (const space of spaces ?? []) {
    // 這個 space 的所有 asset 位元組（含 rendition）—— 位元組只存在這兩張表（ADR-005）
    const { data: assets } = await db
      .from('assets')
      .select('id, storage_key')
      .eq('space_id', space.id)

    const assetIds = (assets ?? []).map((a) => a.id)
    let renditionKeys: string[] = []
    if (assetIds.length > 0) {
      const { data: renditions } = await db
        .from('asset_renditions')
        .select('storage_key')
        .in('asset_id', assetIds)
      renditionKeys = (renditions ?? []).map((r) => r.storage_key)
    }

    const keys = [...(assets ?? []).map((a) => a.storage_key), ...renditionKeys]

    if (keys.length > 0) {
      const { failed } = await store.deleteMany(keys)
      if (failed.length > 0) {
        // 有物件沒刪成功就先不刪 DB，下次再試 —— 否則 storage_key 就永遠遺失了
        console.error('[space-purge] 部分物件刪除失敗，保留 space', space.id, failed)
        continue
      }
    }

    // R2 已淨空，才永久刪 space（cascade 連帶清掉所有子表）。
    // 走 purge_space() SECURITY DEFINER：軟刪除的 parent 在 RLS 下對 cascade 的
    // RI 檢查不可見，直接 delete 會報 "RI query gave unexpected result"（見 0029）。
    const { error } = await db.rpc('purge_space', { target_space_id: space.id })
    if (error) {
      console.error('[space-purge] 刪除 space 資料列失敗', space.id, error.message)
      continue
    }
    purged++
    console.log(`[space-purge] 已永久刪除 space ${space.id}（${keys.length} 個物件）`)
  }

  if (purged > 0) {
    console.log(`[space-purge] 本輪永久刪除 ${purged} 個 space`)
  }
}
