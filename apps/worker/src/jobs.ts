import type { Job } from 'pg-boss'
import { startBoss, QUEUES } from './boss.js'

/**
 * Vercel Cron 的進入點（2026-11 從常駐 worker 改寫，apps/worker/src/index.ts 仍可本機常駐執行）。
 *
 * - 週期工作：handler 不看 job 內容，由 /api/cron/run/[job] 直接呼叫。
 * - 佇列工作：web 端照舊 enqueue 到 pg-boss，由 /api/cron/queue 每分鐘取出執行。
 */

type Handler = (jobs: Job<never>[]) => Promise<void>

const SCHEDULED: Record<string, () => Promise<Handler>> = {
  'event-project': async () => (await import('./handlers/event-project.js')).handleEventProject as Handler,
  'daily-generate': async () => (await import('./handlers/daily-cron.js')).handleDailyGenerate as Handler,
  'insight-weekly': async () => (await import('./handlers/daily-cron.js')).handleInsightWeekly as Handler,
  'queue-health': async () => (await import('./handlers/maintenance.js')).handleQueueHealth as Handler,
  'storage-gc': async () => (await import('./handlers/maintenance.js')).handleStorageGc as Handler,
  'space-purge': async () => (await import('./handlers/maintenance.js')).handleSpacePurge as Handler,
}

const QUEUED: Record<string, () => Promise<Handler>> = {
  [QUEUES.ping]: async () => (await import('./handlers/ping.js')).handlePing as unknown as Handler,
  [QUEUES.assetProcess]: async () =>
    (await import('./handlers/asset-process.js')).handleAssetProcess as unknown as Handler,
  [QUEUES.fontInstall]: async () =>
    (await import('./handlers/font-install.js')).handleFontInstall as unknown as Handler,
  [QUEUES.designSync]: async () =>
    (await import('./handlers/design-sync.js')).handleDesignSync as unknown as Handler,
}

/** 執行一個週期工作；名稱不存在回傳 false。 */
export async function runScheduledJob(name: string): Promise<boolean> {
  if (!Object.hasOwn(SCHEDULED, name)) return false
  const handler = await SCHEDULED[name]!()
  await handler([])
  return true
}

/**
 * 取出佇列工作逐一執行，直到清空或超過 budgetMs（超過後不再開始新工作）。
 * 函式被平台中斷時，job 會在 pg-boss 逾時後自動重試。
 */
export async function drainQueues(budgetMs: number): Promise<{ done: number; failed: number }> {
  const boss = await startBoss()
  const names = Object.keys(QUEUED)
  await Promise.all(names.map((name) => boss.createQueue(name).catch(() => {})))

  const deadline = Date.now() + budgetMs
  let done = 0
  let failed = 0
  let found = true
  while (found && Date.now() < deadline) {
    found = false
    for (const name of names) {
      if (Date.now() >= deadline) break
      const [job] = await boss.fetch<never>(name, { batchSize: 1 })
      if (!job) continue
      found = true
      try {
        const handler = await QUEUED[name]!()
        await handler([job])
        await boss.complete(name, job.id)
        done++
      } catch (err) {
        console.error('[jobs] 失敗', name, job.id, err)
        await boss.fail(name, job.id, { message: err instanceof Error ? err.message : String(err) })
        failed++
      }
    }
  }
  return { done, failed }
}
