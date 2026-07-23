import type { Job } from 'pg-boss'
import { createAdminClient } from '@snowrealm/db/server'
import type { JobPayloads } from '../boss.js'

/**
 * 測試 job。證明「入列 → worker 消費 → 寫回 job_records」這條路徑通了。
 *
 * 同時示範 08-jobs-events.md §2.3 的冪等模式：
 * handler 自身必須冪等，不能靠 queue 保證只跑一次。
 * pg-boss 是 at-least-once —— worker 在寫入 DB 後、標記完成前崩潰，job 就會重跑。
 */
export async function handlePing(jobs: Job<JobPayloads['ping']>[]): Promise<void> {
  const db = createAdminClient()

  for (const job of jobs) {
    // 冪等檢查：這個 job 已經處理過了嗎？
    const { data: existing } = await db
      .from('job_records')
      .select('id, status')
      .eq('idempotency_key', `ping:${job.id}`)
      .maybeSingle()

    if (existing?.status === 'completed') {
      console.log(`[ping] ${job.id} 已完成，略過`)
      continue
    }

    const startedAt = new Date().toISOString()

    await db.from('job_records').upsert(
      {
        type: 'ping',
        status: 'running',
        payload: job.data as never,
        idempotency_key: `ping:${job.id}`,
        space_id: job.data.spaceId ?? null,
        started_at: startedAt,
      },
      { onConflict: 'idempotency_key' },
    )

    try {
      console.log(`[ping] ${job.data.message}`)

      await db
        .from('job_records')
        .update({
          status: 'completed',
          result: { echoed: job.data.message } as never,
          completed_at: new Date().toISOString(),
        })
        .eq('idempotency_key', `ping:${job.id}`)
    } catch (err: unknown) {
      // 永不靜默失敗（v1.0 §46）
      await db
        .from('job_records')
        .update({
          status: 'failed',
          last_error: err instanceof Error ? err.message : String(err),
          completed_at: new Date().toISOString(),
        })
        .eq('idempotency_key', `ping:${job.id}`)
      throw err
    }
  }
}
