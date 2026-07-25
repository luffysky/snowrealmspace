import { randomBytes } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { shareCreateSchema } from '@snowrealm/validation'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

/** 列出某作品的分享連結（未撤銷在前）。 */
export const GET = handler(async (request: NextRequest) => {
  const result = await resolveContext()
  if (!result.ok) return fail(result.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '沒有存取權。')
  const { ctx } = result
  const fileId = z.string().uuid().safeParse(new URL(request.url).searchParams.get('designFileId'))
  if (!fileId.success) return fail('VALIDATION_FAILED', 'designFileId 不正確。')

  const { data, error } = await ctx.db
    .from('share_links')
    .select('id, token, expires_at, revoked_at, created_at')
    .eq('space_id', ctx.spaceId)
    .eq('design_file_id', fileId.data)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return fail('INTERNAL', '載入分享連結失敗。')
  return ok(data ?? [])
})

/** 建立一條唯讀分享連結。 */
export const POST = handler(async (request: NextRequest) => {
  const result = await resolveContext()
  if (!result.ok) return fail(result.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '沒有存取權。')
  const { ctx } = result
  const body: unknown = await request.json().catch(() => null)
  const parsed = shareCreateSchema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)

  // 作品必須屬於這個 space（RLS：查不到就不是成員的）
  const { data: file } = await ctx.db
    .from('design_files')
    .select('id')
    .eq('id', parsed.data.designFileId)
    .eq('space_id', ctx.spaceId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!file) return fail('NOT_FOUND', '找不到這件作品。')

  const token = randomBytes(18).toString('base64url')
  const expiresAt =
    parsed.data.expiresInDays != null
      ? new Date(Date.now() + parsed.data.expiresInDays * 24 * 3600 * 1000).toISOString()
      : null

  const { data, error } = await ctx.db
    .from('share_links')
    .insert({
      token,
      space_id: ctx.spaceId,
      design_file_id: parsed.data.designFileId,
      expires_at: expiresAt,
      created_by: ctx.userId,
    })
    .select('id, token, expires_at, revoked_at, created_at')
    .single()
  if (error || !data) return fail('INTERNAL', '建立分享連結失敗。')
  return ok(data)
})
