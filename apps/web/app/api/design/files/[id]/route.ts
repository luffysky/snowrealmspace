import type { NextRequest } from 'next/server'
import { designFilePatchSchema } from '@snowrealm/validation'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

const COLUMNS =
  'id, title, description, provider, project_id, tags, source_url, sync_status, created_at, updated_at'

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
      .from('design_files')
      .select(
        `${COLUMNS}, snapshots:design_snapshots(id, asset_id, external_version_id, extracted_features, created_at)`,
      )
      .eq('id', id)
      .eq('space_id', ctx.spaceId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!data) return fail('NOT_FOUND', '找不到這個作品。')
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
    const parsed = designFilePatchSchema.safeParse(body)
    if (!parsed.success) return failValidation(parsed.error)
    const input = parsed.data

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

    type FileUpdate = {
      title?: string
      description?: string | null
      project_id?: string | null
      tags?: string[]
    }
    const patch: FileUpdate = {}
    if (input.title !== undefined) patch.title = input.title
    if (input.description !== undefined) patch.description = input.description
    if (input.projectId !== undefined) patch.project_id = input.projectId
    if (input.tags !== undefined) patch.tags = input.tags

    const { data, error } = await ctx.db
      .from('design_files')
      .update(patch)
      .eq('id', id)
      .eq('space_id', ctx.spaceId)
      .is('deleted_at', null)
      .select(COLUMNS)
      .maybeSingle()

    if (error) return fail('INTERNAL', '無法更新作品。')
    if (!data) return fail('NOT_FOUND', '找不到這個作品。')
    return ok(data)
  },
)

/**
 * 軟刪除作品。snapshots 是它的版本，隨作品一起隱藏；
 * asset 不動（可能還被當背景或別的作品用）—— 見 02-domain-model.md §5.4。
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
      .from('design_files')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('space_id', ctx.spaceId)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle()

    if (error) return fail('INTERNAL', '無法刪除作品。')
    if (!data) return fail('NOT_FOUND', '找不到這個作品。')
    return ok({ id: data.id, deleted: true })
  },
)
