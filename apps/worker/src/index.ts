import { config } from 'dotenv'

config({ path: '../../.env.local' })
config({ path: '.env.local' })
config({ path: '../../.env' })

const { startBoss, stopBoss, QUEUES } = await import('./boss.js')
const { handlePing } = await import('./handlers/ping.js')
const { handleAssetProcess } = await import('./handlers/asset-process.js')

/**
 * Worker 進程。
 *
 * ADR-008：長駐服務，不是 serverless function。
 * 影片轉碼與 Vision 分析會超過 serverless 的時間上限，
 * 所以從第一天就用長駐 process，避免屆時搬遷。
 */
async function main() {
  console.log('[worker] 啟動中…')

  const boss = await startBoss()

  await boss.createQueue(QUEUES.ping)
  await boss.work(QUEUES.ping, { batchSize: 1 }, handlePing)

  // 08-jobs-events.md §2.2：併發 4、重試 3 次
  await boss.createQueue(QUEUES.assetProcess)
  await boss.work(QUEUES.assetProcess, { batchSize: 1 }, handleAssetProcess)

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
