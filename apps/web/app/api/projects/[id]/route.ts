import type { NextRequest } from 'next/server'
import { projectPatchSchema, type ProjectStatus } from '@snowrealm/validation'
import { emitEvent } from '@snowrealm/analytics'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

const COLUMNS =
  'id, name, description, status, cover_asset_id, tags, last_activity_at, created_at, updated_at'

export const GET = handler(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const result = await resolveContext()
    if (!result.ok) {
      if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
      return fail('FORBIDDEN', '你沒有這個空間的存取權。')
    }
    const { ctx } = result
    const { id } = await params

    const { data } = await ctx.db
      .from('projects')
      .select(COLUMNS)
      .eq('id', id)
      .eq('space_id', ctx.spaceId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!data) return fail('NOT_FOUND', '找不到這個專案。')
    return ok(data)
  },
)

export const PATCH = handler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const result = await resolveContext()
    if (!result.ok) {
      if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
      return fail('FORBIDDEN', '你沒有這個空間的存取權。')
    }
    const { ctx } = result
    const { id } = await params

    const body: unknown = await request.json().catch(() => null)
    const parsed = projectPatchSchema.safeParse(body)
    if (!parsed.success) return failValidation(parsed.error)
    const input = parsed.data

    // 先取現值：狀態變更要發出 from→to 事件，且確認專案存在於本 space。
    const { data: current } = await ctx.db
      .from('projects')
      .select('id, status')
      .eq('id', id)
      .eq('space_id', ctx.spaceId)
      .is('deleted_at', null)
      .maybeSingle()
    if (!current) return fail('NOT_FOUND', '找不到這個專案。')

    type ProjectUpdate = {
      last_activity_at: string
      name?: string
      description?: string | null
      status?: ProjectStatus
      cover_asset_id?: string | null
      tags?: string[]
    }
    const patch: ProjectUpdate = { last_activity_at: new Date().toISOString() }
    if (input.name !== undefined) patch.name = input.name
    if (input.description !== undefined) patch.description = input.description
    if (input.status !== undefined) patch.status = input.status
    if (input.coverAssetId !== undefined) patch.cover_asset_id = input.coverAssetId
    if (input.tags !== undefined) patch.tags = input.tags

    const { data, error } = await ctx.db
      .from('projects')
      .update(patch)
      .eq('id', id)
      .eq('space_id', ctx.spaceId)
      .select(COLUMNS)
      .single()

    if (error || !data) {
      console.error('[projects] 更新失敗', error?.message)
      return fail('INTERNAL', '無法更新專案。')
    }

    if (input.status !== undefined && input.status !== current.status) {
      await emitEvent('project.status_changed', ctx.spaceId, ctx.userId, {
        projectId: data.id,
        from: current.status,
        to: input.status,
      })
      if (input.status === 'completed') {
        await emitEvent('project.completed', ctx.spaceId, ctx.userId, {
          projectId: data.id,
          name: data.name,
        })
      }
    }

    return ok(data)
  },
)

/**
 * 軟刪除。design_files.project_id 是 on delete set null，
 * 所以刪除專案只會把作品的歸屬解除，不會刪到作品或位元組。
 */
export const DELETE = handler(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const result = await resolveContext()
    if (!result.ok) {
      if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
      return fail('FORBIDDEN', '你沒有這個空間的存取權。')
    }
    const { ctx } = result
    const { id } = await params

    const { data, error } = await ctx.db
      .from('projects')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('space_id', ctx.spaceId)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('[projects] 刪除失敗', error.message)
      return fail('INTERNAL', '無法刪除專案。')
    }
    if (!data) return fail('NOT_FOUND', '找不到這個專案。')
    return ok({ id: data.id, deleted: true })
  },
)
