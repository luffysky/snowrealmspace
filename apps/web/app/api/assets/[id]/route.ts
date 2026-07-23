import type { NextRequest } from 'next/server'
import { assetPatchSchema } from '@snowrealm/validation'
import { createAdminClient } from '@snowrealm/db/server'
import { emitEvent, audit } from '@snowrealm/analytics'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'
import { findReferences } from '@/lib/api/asset-references'

export const dynamic = 'force-dynamic'

export const GET = handler(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const result = await resolveContext()
    if (!result.ok) return fail('UNAUTHENTICATED', '請先登入。')
    const { ctx } = result
    const { id } = await params

    const { data } = await ctx.db
      .from('assets')
      .select('*')
      .eq('id', id)
      .eq('space_id', ctx.spaceId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!data) return fail('NOT_FOUND', '找不到這個檔案。')
    return ok(data)
  },
)

export const PATCH = handler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const result = await resolveContext()
    if (!result.ok) return fail('UNAUTHENTICATED', '請先登入。')
    const { ctx } = result
    const { id } = await params

    const body: unknown = await request.json().catch(() => null)
    const parsed = assetPatchSchema.safeParse(body)
    if (!parsed.success) return failValidation(parsed.error)

    // assets 是不可變的（ADR-005），只有顯示用的檔名可改
    const { data, error } = await ctx.db
      .from('assets')
      .update({ original_filename: parsed.data.originalFilename })
      .eq('id', id)
      .eq('space_id', ctx.spaceId)
      .select('id, original_filename')
      .maybeSingle()

    if (error) return fail('INTERNAL', '無法更新。')
    if (!data) return fail('NOT_FOUND', '找不到這個檔案。')
    return ok(data)
  },
)

/**
 * 刪除。見 docs/spec/02-domain-model.md §5.4。
 *
 * 有引用時回 409 並列出引用清單，讓使用者知道刪了會影響什麼。
 * `?cascade=true` 才一併刪除引用。
 *
 * 軟刪除 + 30 天寬限：誤刪一件重要作品且立刻永久消失，
 * 是這個產品最不能發生的事 —— 它宣稱自己會累積回憶。
 */
export const DELETE = handler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const result = await resolveContext()
    if (!result.ok) return fail('UNAUTHENTICATED', '請先登入。')
    const { ctx } = result
    const { id } = await params
    const cascade = request.nextUrl.searchParams.get('cascade') === 'true'

    const admin = createAdminClient()
    const { data: asset } = await admin
      .from('assets')
      .select('id, space_id, original_filename')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (!asset || asset.space_id !== ctx.spaceId) {
      return fail('NOT_FOUND', '找不到這個檔案。')
    }

    const references = await findReferences(admin, ctx.spaceId, id)

    if (references.length > 0 && !cascade) {
      return fail('HAS_REFERENCES', '這個檔案還在別的地方被使用。', {
        references,
      })
    }

    if (cascade) {
      for (const ref of references) {
        if (ref.type === 'background_item') {
          await admin.from('background_items').update({ deleted_at: new Date().toISOString() }).eq('id', ref.id)
        }
        if (ref.type === 'theme') {
          await admin.from('themes').update({ source_asset_id: null }).eq('id', ref.id)
        }
      }
    }

    const { error } = await admin
      .from('assets')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      console.error('[assets] 刪除失敗', error.message)
      return fail('INTERNAL', '無法刪除，請稍後再試。')
    }

    await audit({
      spaceId: ctx.spaceId,
      actorId: ctx.userId,
      action: 'asset.deleted',
      entityType: 'asset',
      entityId: id,
      before: { filename: asset.original_filename, references: references.length },
    })

    await emitEvent('asset.deleted', ctx.spaceId, ctx.userId, { assetId: id, cascade })

    return ok({ id, deleted: true, cascadedReferences: cascade ? references.length : 0 })
  },
)
