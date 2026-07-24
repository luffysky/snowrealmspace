import type { NextRequest } from 'next/server'
import { designFileCreateSchema, designFileListQuerySchema } from '@snowrealm/validation'
import { createAdminClient } from '@snowrealm/db/server'
import { emitEvent } from '@snowrealm/analytics'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'
import { createSnapshotFromAsset } from '@/lib/design/snapshots'

export const dynamic = 'force-dynamic'

const COLUMNS =
  'id, title, description, provider, project_id, tags, source_url, sync_status, created_at, updated_at'

export const GET = handler(async (request: NextRequest) => {
  const result = await resolveContext()
  if (!result.ok) {
    if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
    return fail('FORBIDDEN', '你沒有這個空間的存取權。')
  }
  const { ctx } = result

  const parsed = designFileListQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  )
  if (!parsed.success) return failValidation(parsed.error)
  const { projectId, tag, q, limit } = parsed.data

  let query = ctx.db
    .from('design_files')
    .select(`${COLUMNS}, snapshots:design_snapshots(id, asset_id, created_at)`)
    .eq('space_id', ctx.spaceId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (projectId) query = query.eq('project_id', projectId)
  if (tag) query = query.contains('tags', [tag])
  if (q) query = query.ilike('title', `%${q}%`)

  const { data, error } = await query
  if (error) {
    console.error('[design.files] 查詢失敗', error.message)
    return fail('INTERNAL', '無法載入作品。')
  }
  return ok(data ?? [])
})

export const POST = handler(async (request: NextRequest) => {
  const result = await resolveContext()
  if (!result.ok) {
    if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
    return fail('FORBIDDEN', '你沒有這個空間的存取權。')
  }
  const { ctx } = result

  const body: unknown = await request.json().catch(() => null)
  const parsed = designFileCreateSchema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)
  const input = parsed.data

  // 若指定專案，確認專案屬於本 space（RLS 讓越權的查不到）
  if (input.projectId) {
    const { data: project } = await ctx.db
      .from('projects')
      .select('id')
      .eq('id', input.projectId)
      .eq('space_id', ctx.spaceId)
      .is('deleted_at', null)
      .maybeSingle()
    if (!project) return fail('NOT_FOUND', '找不到指定的專案。')
  }

  // 建 design_file（成員 policy 允許）
  const { data: file, error } = await ctx.db
    .from('design_files')
    .insert({
      space_id: ctx.spaceId,
      created_by: ctx.userId,
      provider: 'upload',
      title: input.title,
      description: input.description ?? null,
      project_id: input.projectId ?? null,
      tags: input.tags ?? [],
    })
    .select(COLUMNS)
    .single()

  if (error || !file) {
    console.error('[design.files] 建立失敗', error?.message)
    return fail('INTERNAL', '無法建立作品。')
  }

  // 建第一筆版本快照（走 service role）
  const snap = await createSnapshotFromAsset(ctx, file.id, input.assetId)
  if (!snap.ok) {
    // 回滾：剛建的 design_file 沒有版本沒有意義，刪掉
    await createAdminClient().from('design_files').delete().eq('id', file.id)
    const messages: Record<string, string> = {
      asset_not_found: '找不到指定的檔案。',
      asset_not_ready: '這個檔案還在處理中，稍後再試。',
      duplicate: '這個檔案已經是一個版本了。',
      error: '建立版本時發生問題。',
    }
    return fail('UNPROCESSABLE', messages[snap.reason] ?? '無法建立作品。')
  }

  await emitEvent('design.linked', ctx.spaceId, ctx.userId, {
    designFileId: file.id,
    assetId: input.assetId,
    provider: 'upload',
  })

  return ok({ ...file, snapshotId: snap.snapshotId }, undefined, 201)
})
