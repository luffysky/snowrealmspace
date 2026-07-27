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
  // 每日/每週時區掃描（08-jobs-events.md §3.1）
  dailyGenerate: 'daily.generate',
  insightWeekly: 'insight.weekly',
  // 維護類（由 schedules.ts 週期觸發）
  queueHealth: 'maintenance.queue-health',
  storageGc: 'maintenance.storage-gc',
  // 軟刪除滿寬限期的 space 的永久清除（R2 先於 DB）
  spacePurge: 'maintenance.space-purge',
  // 字體自動安裝（中文子集化太重，同步 HTTP 會 524；移背景）
  fontInstall: 'font.install',
  // Design provider 同步（Milestone F sync 半段 S2）：背景執行、退避重試、429 依 Retry-After
  designSync: 'design.sync',
} as const

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES]

export type JobPayloads = {
  ping: { message: string; spaceId?: string }
  'asset.process': { assetId: string; spaceId: string }
  'event.project': Record<string, never>
  'daily.generate': Record<string, never>
  'insight.weekly': Record<string, never>
  'maintenance.queue-health': Record<string, never>
  'maintenance.storage-gc': Record<string, never>
  'maintenance.space-purge': Record<string, never>
  // 每次 job 處理「單一檔案」，以利獨立去重/退避/連 5 次失敗轉 error。attempt 由 1 起算。
  'design.sync': { connectionId: string; spaceId: string; externalId: string; attempt: number }
}
