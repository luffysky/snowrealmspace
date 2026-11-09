import { NextResponse, type NextRequest } from 'next/server'
import { serverEnv } from '@snowrealm/shared-types'
import { drainQueues } from '@snowrealm/worker/jobs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// 字體子集化可能要數分鐘，所以上限拉滿；超過 budget 就不再開始新工作
export const maxDuration = 800

const START_NEW_JOBS_MS = 5 * 60 * 1000

/** 每分鐘由 Vercel Cron 觸發：取出 pg-boss 佇列的工作執行。 */
export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${serverEnv().CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(await drainQueues(START_NEW_JOBS_MS))
}
