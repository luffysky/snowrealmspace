import type { Db } from '@snowrealm/db/server'

/**
 * 同步作業的最小上下文。web 傳受 RLS 約束的 getDb() client；worker 傳 service role client。
 * 兩者結構相容於 apps/web 的 ApiContext（多帶 role 也可，這裡只取 db/userId/spaceId）。
 */
export type SyncContext = { db: Db; userId: string; spaceId: string }
