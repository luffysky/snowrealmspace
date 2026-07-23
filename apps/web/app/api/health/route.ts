import { NextResponse } from 'next/server'
import { createAdminClient } from '@snowrealm/db/server'
import { storage } from '@snowrealm/storage'

export const dynamic = 'force-dynamic'

type Check = { name: string; ok: boolean; detail?: string }

/**
 * 供 uptime 監控使用。
 * 回傳 DB / 儲存 / queue 三者的連線狀態（11-engineering-setup.md §11）。
 *
 * 不需要認證，但也不得洩漏任何設定值 —— 只回 ok / 錯誤類別。
 */
export async function GET() {
  const checks: Check[] = []

  try {
    const db = createAdminClient()
    const { error } = await db.from('feature_flags').select('key').limit(1)
    checks.push({ name: 'database', ok: !error, ...(error ? { detail: 'query_failed' } : {}) })
  } catch {
    checks.push({ name: 'database', ok: false, detail: 'unreachable' })
  }

  try {
    await storage().list('healthcheck/', 1)
    checks.push({ name: 'storage', ok: true })
  } catch (err) {
    // 靜默失敗會讓健康檢查失去意義 —— 「壞了」而不知道為什麼等於沒檢查。
    // 對外只回錯誤類別，細節寫進伺服器 log。
    console.error('[health] storage 檢查失敗', err)
    checks.push({
      name: 'storage',
      ok: false,
      detail: err instanceof Error ? err.name : 'unreachable',
    })
  }

  try {
    const db = createAdminClient()
    const { error } = await db.from('job_records').select('id').limit(1)
    checks.push({ name: 'queue', ok: !error, ...(error ? { detail: 'query_failed' } : {}) })
  } catch {
    checks.push({ name: 'queue', ok: false, detail: 'unreachable' })
  }

  const healthy = checks.every((c) => c.ok)

  return NextResponse.json(
    { status: healthy ? 'ok' : 'degraded', checks },
    { status: healthy ? 200 : 503 },
  )
}
