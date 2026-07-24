import type { NextRequest } from 'next/server'
import { projectCreateSchema, projectListQuerySchema } from '@snowrealm/validation'
import { emitEvent } from '@snowrealm/analytics'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

const LIST_COLUMNS =
  'id, name, description, status, cover_asset_id, tags, last_activity_at, created_at, updated_at'

export const GET = handler(async (request: NextRequest) => {
  const result = await resolveContext()
  if (!result.ok) {
    if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
    return fail('FORBIDDEN', '你沒有這個空間的存取權。')
  }
  const { ctx } = result

  const parsed = projectListQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  )
  if (!parsed.success) return failValidation(parsed.error)
  const { status, tag, q, limit } = parsed.data

  let query = ctx.db
    .from('projects')
    .select(LIST_COLUMNS)
    .eq('space_id', ctx.spaceId)
    .is('deleted_at', null)
    .order('last_activity_at', { ascending: false })
    .limit(limit)

  if (status) query = query.eq('status', status)
  if (tag) query = query.contains('tags', [tag])
  if (q) query = query.ilike('name', `%${q}%`)

  const { data, error } = await query
  if (error) {
    console.error('[projects] 查詢失敗', error.message)
    return fail('INTERNAL', '無法載入專案。')
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
  const parsed = projectCreateSchema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)
  const input = parsed.data

  const { data, error } = await ctx.db
    .from('projects')
    .insert({
      space_id: ctx.spaceId,
      created_by: ctx.userId,
      name: input.name,
      description: input.description ?? null,
      status: input.status,
      cover_asset_id: input.coverAssetId ?? null,
      tags: input.tags ?? [],
    })
    .select(LIST_COLUMNS)
    .single()

  if (error || !data) {
    console.error('[projects] 建立失敗', error?.message)
    return fail('INTERNAL', '無法建立專案。')
  }

  await emitEvent('project.created', ctx.spaceId, ctx.userId, {
    projectId: data.id,
    name: data.name,
  })

  return ok(data, undefined, 201)
})
