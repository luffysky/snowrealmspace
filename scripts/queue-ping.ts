/**
 * 驗證 queue 往返：入列 → worker 消費 → 寫回 job_records。
 *
 * Milestone A 的驗收條件之一（10-acceptance.md）：
 * 「pg-boss 啟動，一個測試 job 可以入列並被 worker 消費」。
 *
 * 用法：worker 執行中時跑 `pnpm tsx scripts/queue-ping.ts`
 */
import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })

const PgBoss = (await import('pg-boss')).default
const { createAdminClient } = await import('@snowrealm/db/server')

const message = `ping-${Date.now()}`

const boss = new PgBoss({
  connectionString: process.env.DATABASE_URL!,
  schema: 'pgboss',
})

await boss.start()
await boss.createQueue('ping')

const jobId = await boss.send('ping', { message })
if (!jobId) {
  console.error('入列失敗')
  process.exit(1)
}
console.log(`已入列 job ${jobId}（message=${message}）`)

// 等 worker 消費。最多 20 秒。
const db = createAdminClient()
const deadline = Date.now() + 20_000
let record: { status: string; result: unknown } | null = null

while (Date.now() < deadline) {
  const { data } = await db
    .from('job_records')
    .select('status, result')
    .eq('idempotency_key', `ping:${jobId}`)
    .maybeSingle()

  if (data?.status === 'completed') {
    record = data
    break
  }
  await new Promise((r) => setTimeout(r, 500))
}

await boss.stop({ graceful: true })

if (!record) {
  console.error('✗ 20 秒內沒有被消費。worker 有在跑嗎？')
  process.exit(1)
}

console.log(`✓ job 已完成，result = ${JSON.stringify(record.result)}`)
process.exit(0)
