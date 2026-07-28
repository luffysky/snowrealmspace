import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

const query = z.object({ fileId: z.string().uuid() })

type Statements = { text?: unknown; deep?: unknown }

/** statements（jsonb）→ 分析全文。相容舊格式（陣列）與新格式（{text,...}）。 */
function summaryOf(statements: unknown): string {
  if (statements && typeof statements === 'object' && !Array.isArray(statements)) {
    const t = (statements as Statements).text
    if (typeof t === 'string') return t
  }
  if (Array.isArray(statements)) {
    return statements
      .map((s) => (s && typeof s === 'object' ? String((s as { text?: unknown }).text ?? '') : ''))
      .filter(Boolean)
      .join('\n')
  }
  return ''
}

/**
 * 某件作品的「分析歷史」（design_insights，member RLS 唯讀）。
 * join：design_insights → design_snapshots（版本）→ design_files（provider）→ projects（專案名）。
 * 版本標籤（v1、v2…）用該作品全部快照依 created_at 排序後的序位算出。
 */
export const GET = handler(async (request: NextRequest) => {
  const result = await resolveContext()
  if (!result.ok) return fail(result.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '沒有存取權。')
  const { ctx } = result

  const parsed = query.safeParse({ fileId: request.nextUrl.searchParams.get('fileId') })
  if (!parsed.success) return failValidation(parsed.error)
  const { fileId } = parsed.data

  // 作品本體（來源軟體 + 專案名）；RLS 保證屬於本 space
  const { data: file } = await ctx.db
    .from('design_files')
    .select('id, provider, projects(name)')
    .eq('id', fileId)
    .eq('space_id', ctx.spaceId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!file) return fail('NOT_FOUND', '找不到這件作品。')
  const provider = file.provider
  const projectName = (file as { projects?: { name?: string } | null }).projects?.name ?? null

  // 版本序位（v1、v2…）：依 created_at 正序
  const { data: snaps } = await ctx.db
    .from('design_snapshots')
    .select('id, created_at')
    .eq('design_file_id', fileId)
    .eq('space_id', ctx.spaceId)
    .order('created_at', { ascending: true })
  const versionLabel = new Map<string, string>()
  ;(snaps ?? []).forEach((s, i) => versionLabel.set(s.id, `v${i + 1}`))
  const snapshotIds = (snaps ?? []).map((s) => s.id)
  if (snapshotIds.length === 0) return ok([])

  // 該作品全部快照的分析，最新在前
  const { data: rows } = await ctx.db
    .from('design_insights')
    .select('id, snapshot_id, kind, statements, model_used, created_at')
    .in('snapshot_id', snapshotIds)
    .eq('space_id', ctx.spaceId)
    .order('created_at', { ascending: false })
    .limit(100)

  const insights = (rows ?? []).map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    kind: r.kind,
    model: r.model_used,
    summary: summaryOf(r.statements),
    projectName,
    provider,
    versionLabel: r.snapshot_id ? (versionLabel.get(r.snapshot_id) ?? null) : null,
  }))

  return ok(insights)
})
