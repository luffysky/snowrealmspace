import PgBoss from 'pg-boss'
import { serverEnv } from '@snowrealm/shared-types'

/**
 * 從 web 端入列 job。
 *
 * 這裡只負責 send，實際執行在 apps/worker（ADR-008：worker 是長駐服務，
 * 影片轉碼與 Vision 分析會超過 serverless 的時間上限）。
 *
 * 連線是 lazy 且共用的 —— 每次請求都開新連線會很快耗盡 Postgres 的連線數。
 */

let bossPromise: Promise<PgBoss> | null = null

async function getBoss(): Promise<PgBoss> {
  bossPromise ??= (async () => {
    const boss = new PgBoss({
      connectionString: serverEnv().DATABASE_URL,
      schema: 'pgboss',
      // web 端只送不收，不需要維護 worker 相關的背景程序
      supervise: false,
      max: 2,
    })
    boss.on('error', (err) => console.error('[queue] 錯誤', err))
    await boss.start()
    return boss
  })()
  return bossPromise
}

export type JobName = 'asset.process' | 'asset.analyze_local' | 'theme.from_mood'

/**
 * 入列。
 *
 * fail-soft：入列失敗不讓使用者的操作失敗，但一定要記錄 ——
 * 靜默丟失 job 會讓縮圖永遠不出現而沒人知道為什麼。
 */
export async function enqueue(
  name: JobName,
  data: Record<string, unknown>,
  options: { singletonKey?: string } = {},
): Promise<string | null> {
  try {
    const boss = await getBoss()
    await boss.createQueue(name).catch(() => {})
    const id = await boss.send(
      name,
      data,
      options.singletonKey ? { singletonKey: options.singletonKey } : {},
    )
    if (!id) console.error('[queue] 入列未回傳 id', { name, data })
    return id
  } catch (err) {
    console.error('[queue] 入列失敗', { name, err })
    return null
  }
}
