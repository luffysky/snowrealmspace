import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { createAdminClient } from '@snowrealm/db/server'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

const postSchema = z.object({ subjectUserId: z.string().uuid(), body: z.string().trim().min(1).max(2000) }).strict()

async function gate() {
  const g = await checkSiteAdmin()
  if (!g.ok) return { res: fail(g.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '需要站台管理員身份。') }
  return { g }
}

/** 新增一則使用者註記。 */
export const POST = handler(async (request: NextRequest) => {
  const gr = await gate()
  if ('res' in gr) return gr.res

  const body: unknown = await request.json().catch(() => null)
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('admin_user_notes')
    .insert({ subject_user_id: parsed.data.subjectUserId, author_id: gr.g.userId, body: parsed.data.body } as never)
    .select('id, body, author_id, created_at')
    .single()
  if (error || !data) {
    console.error('[user-notes] 新增失敗', error?.message)
    return fail('INTERNAL', '新增失敗。')
  }
  return ok(data, undefined, 201)
})

/** 刪除一則註記。 */
export const DELETE = handler(async (request: NextRequest) => {
  const gr = await gate()
  if ('res' in gr) return gr.res

  const id = z.string().uuid().safeParse(new URL(request.url).searchParams.get('id'))
  if (!id.success) return fail('VALIDATION_FAILED', 'id 不正確。')

  const admin = createAdminClient()
  const { error } = await admin.from('admin_user_notes').delete().eq('id', id.data)
  if (error) return fail('INTERNAL', '刪除失敗。')
  return ok({ id: id.data, deleted: true })
})
