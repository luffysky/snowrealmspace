import type PgBoss from 'pg-boss'
import { QUEUES } from './boss.js'

/**
 * 週期性工作。
 *
 * ADR-008（Zeabur）：沒有 Vercel Cron，改用 pg-boss 內建的 `schedule()`。
 * 這樣更好 —— 排程與 job 定義在同一個地方，少一個外部觸發點，
 * 也不需要對外開放 `/api/cron/*` 端點與共享 CRON_SECRET。
 *
 * pg-boss 的排程存在資料庫，多個 worker 執行個體只會有一個真的執行，
 * 不會重複觸發。
 *
 * ⚠️ 每小時掃時區的設計（08-jobs-events.md §3.1）不變：
 * 「每天早上」在多時區下不是單一時刻，所以排程每小時跑一次，
 * 只挑出當地時間剛好跨過門檻的 space。
 */

export type ScheduleSpec = {
  queue: string
  cron: string
  /** cron 以此時區解讀。系統層的工作用 UTC，避免日光節約時間的意外。 */
  tz: string
  description: string
}

export const SCHEDULES: ScheduleSpec[] = [
  {
    queue: QUEUES.eventProject,
    cron: '* * * * *',
    tz: 'UTC',
    description: '把 activity_events 投影到 timeline_events（ADR-013，每分鐘批次）',
  },
  {
    // 每小時掃描，挑出當地 04:00 的 space（多時區）
    queue: QUEUES.dailyGenerate,
    cron: '0 * * * *',
    tz: 'UTC',
    description: '每小時掃時區，當地 04:00 的 space 生成每日卡片與主動訊息',
  },
  {
    // 每小時掃描，挑出當地週一 09:00 的 space
    queue: QUEUES.insightWeekly,
    cron: '0 * * * *',
    tz: 'UTC',
    description: '每小時掃時區，當地週一 09:00 的 space 生成週回顧與 weekly_recap 通知',
  },
  {
    queue: QUEUES.queueHealth,
    cron: '*/5 * * * *',
    tz: 'UTC',
    description: '檢查卡住的 job；超時的標記 failed 並告警',
  },
  {
    queue: QUEUES.storageGc,
    cron: '0 3 * * *',
    tz: 'UTC',
    description: '清理逾期的 pending 上傳與軟刪除滿 30 天的檔案',
  },
  {
    queue: QUEUES.spacePurge,
    cron: '30 3 * * *',
    tz: 'UTC',
    description: '永久清除軟刪除滿 7 天寬限期的 space（R2 先於 DB）',
  },
  // Milestone E 會加入：
  //   daily.generate   每小時，挑出當地 04:00 的 space
  //   insight.weekly   每小時，挑出當地週一 09:00 的 space
]

export async function registerSchedules(boss: PgBoss): Promise<void> {
  for (const spec of SCHEDULES) {
    await boss.createQueue(spec.queue).catch(() => {})
    // schedule() 是 upsert：重新部署不會產生重複排程
    await boss.schedule(spec.queue, spec.cron, {}, { tz: spec.tz })
    console.log(`[worker] 排程 ${spec.queue} — ${spec.cron} (${spec.tz})：${spec.description}`)
  }
}
