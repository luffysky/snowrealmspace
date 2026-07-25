import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { provisionSpaceForUser } from '@snowrealm/db'
import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { createAdminClient } from '@snowrealm/db/server'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

const schema = z
  .object({
    action: z.enum(['provision-user', 'repair-space']),
    userId: z.string().uuid().optional(),
    spaceId: z.string().uuid().optional(),
  })
  .strict()

/**
 * 孤兒修復（站台管理員）：
 *   - provision-user：為沒有空間的使用者佈建一個空間（冪等，已有就回既有）。
 *   - repair-space：補齊空間缺的附屬表（space_settings / agent_profiles）。
 */
export const PATCH = handler(async (request: NextRequest) => {
  const gate = await checkSiteAdmin()
  if (!gate.ok) {
    return fail(gate.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '需要站台管理員身份。')
  }

  const body: unknown = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)
  const admin = createAdminClient()

  if (parsed.data.action === 'provision-user') {
    if (!parsed.data.userId) return fail('VALIDATION_FAILED', '缺少 userId。')
    const { data: authRes } = await admin.auth.admin.getUserById(parsed.data.userId)
    const email = authRes?.user?.email
    if (!email) return fail('NOT_FOUND', '找不到這位使用者（或沒有 email）。')
    try {
      const result = await provisionSpaceForUser({ userId: parsed.data.userId, email })
      return ok({ spaceId: result.spaceId, slug: result.slug, created: result.created })
    } catch (e) {
      console.error('[provision] 佈建失敗', e)
      return fail('INTERNAL', '佈建失敗。')
    }
  }

  // repair-space：補齊 space_settings 與 agent_profiles
  if (!parsed.data.spaceId) return fail('VALIDATION_FAILED', '缺少 spaceId。')
  const spaceId = parsed.data.spaceId
  const { data: space } = await admin.from('spaces').select('id').eq('id', spaceId).maybeSingle()
  if (!space) return fail('NOT_FOUND', '找不到這個空間。')

  const fixed: string[] = []
  const { data: settings } = await admin.from('space_settings').select('space_id').eq('space_id', spaceId).maybeSingle()
  if (!settings) {
    const { error } = await admin.from('space_settings').insert({ space_id: spaceId } as never)
    if (error) return fail('INTERNAL', '補 space_settings 失敗。')
    fixed.push('space_settings')
  }
  const { data: agent } = await admin.from('agent_profiles').select('space_id').eq('space_id', spaceId).maybeSingle()
  if (!agent) {
    const { error } = await admin.from('agent_profiles').insert({ space_id: spaceId } as never)
    if (error) return fail('INTERNAL', '補 agent_profiles 失敗。')
    fixed.push('agent_profiles')
  }
  return ok({ spaceId, fixed })
})
