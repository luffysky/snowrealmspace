import PgBoss from 'pg-boss'
import { serverEnv } from '@snowrealm/shared-types'

/**
 * pg-boss。ADR-007：跑在同一個 Postgres，schema 為 pgboss。
 *
 * 用同一個 DB 的理由是事務性入列 —— 「建立 snapshot」與「排入分析 job」
 * 必須同生同死。跨服務的 queue 做不到這件事。
 */

let boss: PgBoss | null = null

export function getBoss(): PgBoss {
  if (boss) return boss
  const env = serverEnv()

  boss = new PgBoss({
    connectionString: env.DATABASE_URL,
    schema: 'pgboss',
    retryLimit: 3,
    retryDelay: 30,
    retryBackoff: true,
    expireInMinutes: 30,
    archiveCompletedAfterSeconds: 86_400 * 7,
    deleteAfterDays: 30,
    monitorStateIntervalSeconds: 30,
  })

  boss.on('error', (err) => {
    console.error('[boss] 錯誤', err)
  })

  return boss
}

export async function startBoss(): Promise<PgBoss> {
  const b = getBoss()
  await b.start()
  return b
}

export async function stopBoss(): Promise<void> {
  if (!boss) return
  await boss.stop({ graceful: true, timeout: 30_000 })
  boss = null
}

/** Milestone A 的 job 型別。之後每個 Milestone 會擴充。 */
export const QUEUES = {
  ping: 'ping',
  assetProcess: 'asset.process',
  // Timeline 投影（由 schedules.ts 週期觸發；ADR-013）
  eventProject: 'event.project',
  // 維護類（由 schedules.ts 週期觸發）
  queueHealth: 'maintenance.queue-health',
  storageGc: 'maintenance.storage-gc',
} as const

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES]

export type JobPayloads = {
  ping: { message: string; spaceId?: string }
  'asset.process': { assetId: string; spaceId: string }
  'event.project': Record<string, never>
  'maintenance.queue-health': Record<string, never>
  'maintenance.storage-gc': Record<string, never>
}
