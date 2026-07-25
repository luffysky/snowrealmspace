import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { createAdminClient } from '@snowrealm/db/server'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

const patchSchema = z
  .object({
    userId: z.string().uuid(),
    siteRole: z.enum(['owner', 'admin', 'member']).optional(),
    privileged: z.boolean().optional(),
  })
  .strict()
  .refine((v) => v.siteRole !== undefined || v.privileged !== undefined, {
    message: '至少要改一項',
  })

/**
 * 調整使用者的站台角色與特權。
 * **只有 owner 能改**（admin 只能檢視）。owner 不能改自己的角色（避免把自己降級鎖死）。
 */
export const PATCH = handler(async (request: NextRequest) => {
  const gate = await checkSiteAdmin()
  if (!gate.ok) {
    return fail(gate.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '需要站台管理員身份。')
  }
  if (gate.role !== 'owner') {
    return fail('INSUFFICIENT_ROLE', '只有 owner 能調整使用者權限。')
  }

  const body: unknown = await request.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)
  const { userId, siteRole, privileged } = parsed.data

  // 不允許改自己的角色（避免自我降級把自己鎖在外面）
  if (userId === gate.userId && siteRole !== undefined && siteRole !== 'owner') {
    return fail('UNPROCESSABLE', '不能把自己降級。')
  }

  const patch: Record<string, unknown> = {}
  if (siteRole !== undefined) patch.site_role = siteRole
  if (privileged !== undefined) patch.privileged = privileged

  const admin = createAdminClient()
  // profile 可能還沒建立（理論上註冊就會建），upsert 保險
  const { data, error } = await admin
    .from('profiles')
    .update(patch as never)
    .eq('id', userId)
    .select('id, site_role, privileged')
    .maybeSingle()
  if (error) {
    console.error('[admin/users] 更新失敗', error.message)
    return fail('INTERNAL', '更新失敗。')
  }
  if (!data) return fail('NOT_FOUND', '找不到這位使用者的個人資料。')
  return ok(data)
})
