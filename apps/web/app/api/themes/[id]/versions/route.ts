import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

const createVersionSchema = z.object({ label: z.string().trim().max(80).optional() }).strict()

export const GET = handler(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const result = await resolveContext()
    if (!result.ok) return fail('UNAUTHENTICATED', '請先登入。')
    const { ctx } = result
    const { id } = await params

    const { data } = await ctx.db
      .from('theme_versions')
      .select('id, version, label, created_at')
      .eq('theme_id', id)
      .eq('space_id', ctx.spaceId)
      .order('version', { ascending: false })
      .limit(50)

    return ok(data ?? [])
  },
)

/** v1.0 §11.6：每次儲存主題可建立版本。 */
export const POST = handler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const result = await resolveContext()
    if (!result.ok) return fail('UNAUTHENTICATED', '請先登入。')
    const { ctx } = result
    const { id } = await params

    const body: unknown = await request.json().catch(() => ({}))
    const parsed = createVersionSchema.safeParse(body ?? {})
    if (!parsed.success) return failValidation(parsed.error)

    const { data: theme } = await ctx.db
      .from('themes')
      .select('id, definition')
      .eq('id', id)
      .eq('space_id', ctx.spaceId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!theme) return fail('NOT_FOUND', '找不到這個主題。')

    const { data: latest } = await ctx.db
      .from('theme_versions')
      .select('version')
      .eq('theme_id', id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextVersion = (latest?.version ?? 0) + 1

    const { data, error } = await ctx.db
      .from('theme_versions')
      .insert({
        theme_id: id,
        space_id: ctx.spaceId,
        version: nextVersion,
        label: parsed.data.label ?? null,
        definition: theme.definition,
        created_by: ctx.userId,
      })
      .select('id, version, label, created_at')
      .single()

    if (error || !data) {
      // unique (theme_id, version) 衝突＝有人同時存了版本
      return fail('CONFLICT', '版本建立衝突，請再試一次。')
    }

    return ok(data, undefined, 201)
  },
)
