import { NextResponse, type NextRequest } from 'next/server'
import { serverEnv } from '@snowrealm/shared-types'
import { runScheduledJob } from '@snowrealm/worker/jobs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** 由 Vercel Cron 觸發的週期工作，排程見 apps/web/vercel.json。 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ job: string }> }) {
  if (request.headers.get('authorization') !== `Bearer ${serverEnv().CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { job } = await params
  const ran = await runScheduledJob(job)
  return ran ? NextResponse.json({ ok: true, job }) : NextResponse.json({ error: 'not_found' }, { status: 404 })
}
