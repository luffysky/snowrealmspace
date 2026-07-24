import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { createAdminClient } from '@snowrealm/db/server'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

/** 站台 AI 模型清單（全域表，站台管理員維護）。 */
export const GET = handler(async () => {
  const gate = await checkSiteAdmin()
  if (!gate.ok) return fail(gate.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '需要站台管理員身份。')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('ai_models')
    .select('id, provider, model_name, display_name, is_active, is_free, supports_streaming, supports_tools, supports_vision, context_window, sort_order')
    .order('provider', { ascending: true })
    .order('sort_order', { ascending: true })
  if (error) return fail('INTERNAL', '無法載入模型。')
  return ok(data ?? [])
})

const patchSchema = z
  .object({
    isActive: z.boolean().optional(),
    isFree: z.boolean().optional(),
    supportsStreaming: z.boolean().optional(),
    supportsTools: z.boolean().optional(),
    supportsVision: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: '沒有要更新的欄位' })

const FIELD_MAP: Record<string, string> = {
  isActive: 'is_active',
  isFree: 'is_free',
  supportsStreaming: 'supports_streaming',
  supportsTools: 'supports_tools',
  supportsVision: 'supports_vision',
}

/** 切換模型旗標（啟用/免費/支援串流·工具·視覺）。 */
export const PATCH = handler(async (request: NextRequest) => {
  const gate = await checkSiteAdmin()
  if (!gate.ok) return fail(gate.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '需要站台管理員身份。')

  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  if (!id) return fail('VALIDATION_FAILED', '缺少模型 id。')

  const body: unknown = await request.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const [k, v] of Object.entries(parsed.data)) {
    const col = FIELD_MAP[k]
    if (col) patch[col] = v
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('ai_models')
    .update(patch as never)
    .eq('id', id)
    .select('id')
    .maybeSingle()
  if (error) return fail('INTERNAL', '更新失敗。')
  if (!data) return fail('NOT_FOUND', '找不到這個模型。')
  return ok({ id })
})
