import { config } from 'dotenv'

config({ path: '../../.env.local' })
config({ path: '.env.local' })
config({ path: '../../.env' })

const { startBoss, stopBoss, QUEUES } = await import('./boss.js')
const { handlePing } = await import('./handlers/ping.js')
const { handleAssetProcess } = await import('./handlers/asset-process.js')
const { handleEventProject } = await import('./handlers/event-project.js')
const { handleDailyGenerate, handleInsightWeekly } = await import('./handlers/daily-cron.js')
const { handleQueueHealth, handleStorageGc, handleSpacePurge } = await import(
  './handlers/maintenance.js'
)
const { registerSchedules } = await import('./schedules.js')

/**
 * Worker 進程。
 *
 * ADR-008：長駐服務，不是 serverless function。
 * 影片轉碼與 Vision 分析會超過 serverless 的時間上限，
 * 所以從第一天就用長駐 process，避免屆時搬遷。
 */
async function main() {
  console.log('[worker] 啟動中…')

  // 健康檢查用的極簡 HTTP server。
  //
  // Zeabur 等平台會對服務的 $PORT 做健康檢查；純 pg-boss worker 不聽任何 port，
  // 平台就把它判成「不健康」→ 每隔一段時間送 SIGTERM 重啟（log 會一直看到
  // 「Command failed with signal SIGTERM」的重啟迴圈）。聽一個 port 回 200 即可打破。
  // 沒注入 PORT（例如本機）時就不啟這個 server。
  const healthPort = Number(process.env.PORT)
  if (Number.isFinite(healthPort) && healthPort > 0) {
    const { createServer } = await import('node:http')
    createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/plain' })
      res.end('ok')
    }).listen(healthPort, () => console.log(`[worker] 健康檢查 HTTP 在 :${healthPort}`))
  }

  const boss = await startBoss()

  await boss.createQueue(QUEUES.ping)
  await boss.work(QUEUES.ping, { batchSize: 1 }, handlePing)

  // 08-jobs-events.md §2.2：併發 4、重試 3 次
  await boss.createQueue(QUEUES.assetProcess)
  await boss.work(QUEUES.assetProcess, { batchSize: 1 }, handleAssetProcess)

  // Timeline 投影（ADR-013）。併發 1，靠 source_event_id unique 保冪等。
  await boss.createQueue(QUEUES.eventProject)
  await boss.work(QUEUES.eventProject, { batchSize: 1 }, handleEventProject)

  // 每日/每週時區掃描（08-jobs-events.md §3.1）
  await boss.createQueue(QUEUES.dailyGenerate)
  await boss.work(QUEUES.dailyGenerate, { batchSize: 1 }, handleDailyGenerate)
  await boss.createQueue(QUEUES.insightWeekly)
  await boss.work(QUEUES.insightWeekly, { batchSize: 1 }, handleInsightWeekly)

  await boss.createQueue(QUEUES.queueHealth)
  await boss.work(QUEUES.queueHealth, { batchSize: 1 }, handleQueueHealth)

  await boss.createQueue(QUEUES.storageGc)
  await boss.work(QUEUES.storageGc, { batchSize: 1 }, handleStorageGc)

  await boss.createQueue(QUEUES.spacePurge)
  await boss.work(QUEUES.spacePurge, { batchSize: 1 }, handleSpacePurge)

  const { handleFontInstall } = await import('./handlers/font-install.js')
  await boss.createQueue(QUEUES.fontInstall)
  // 字體安裝很重（中文子集化數分鐘）→ 一次只跑一個，別讓多個一起吃爆記憶體
  await boss.work(QUEUES.fontInstall, { batchSize: 1 }, handleFontInstall)

  // Design provider 同步（Milestone F S2）。重試/退避由 handler 主導（見 design-sync.ts），
  // 併發 2：多檔可平行，但不過度打 provider。
  const { handleDesignSync } = await import('./handlers/design-sync.js')
  await boss.createQueue(QUEUES.designSync)
  await boss.work(QUEUES.designSync, { batchSize: 1 }, handleDesignSync)

  // ADR-008：排程由 pg-boss 自己管，不依賴平台的 Cron
  await registerSchedules(boss)

  console.log(`[worker] 就緒。監聽佇列：${Object.values(QUEUES).join('、')}`)

  const shutdown = async (signal: string) => {
    console.log(`[worker] 收到 ${signal}，正在收尾…`)
    try {
      await stopBoss()
      console.log('[worker] 已停止。')
      process.exit(0)
    } catch (err) {
      console.error('[worker] 收尾失敗', err)
      process.exit(1)
    }
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
}

main().catch((err: unknown) => {
  console.error('[worker] 啟動失敗', err)
  process.exit(1)
})
