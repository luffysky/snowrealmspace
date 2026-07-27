import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { compileFilterPatterns, passesContentFilterWith } from '@snowrealm/validation'
import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { createAdminClient, type Db } from '@snowrealm/db/server'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

/**
 * 生日鏈的後台 CRUD。生日鏈是全站共用範本（content_items kind='chain'），
 * 有 title / 解鎖條件(available_from) / 順序(chain_index) 這些一般文案沒有的欄位，
 * 所以用專屬路由而非通用的 /api/admin/content。文字會過內容安全過濾。
 * 內文可用 {name} 佔位（顯示時代入開啟者名字）。
 */

const AVAIL = [
  'immediately',
  'after_first_theme',
  'after_first_upload',
  'after_7_days',
  'after_1_year',
] as const

async function gate() {
  const g = await checkSiteAdmin()
  if (!g.ok) return { res: fail(g.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '需要站台管理員身份。') }
  return { g }
}

/** {name} 是允許的佔位；過濾時先拿掉它再檢查，避免誤判。 */
async function contentAllowed(admin: Db, text: string): Promise<boolean> {
  const { data } = await admin.from('content_filter_patterns').select('pattern').eq('enabled', true)
  const extra = compileFilterPatterns((data ?? []).map((r) => r.pattern))
  return passesContentFilterWith(text.replaceAll('{name}', '你'), extra)
}

function genId(): string {
  const rand = Array.from({ length: 8 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('')
  return `chain-${rand}`
}

/** 列出生日鏈（依 chain_index）。 */
export const GET = handler(async () => {
  const gr = await gate()
  if ('res' in gr) return gr.res
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('content_items')
    .select('content_id, label, text, chain_index, available_from, enabled')
    .eq('kind', 'chain')
    .order('chain_index', { ascending: true })
  if (error) return fail('INTERNAL', '讀取失敗。')
  return ok(data ?? [])
})

const createSchema = z
  .object({
    title: z.string().trim().min(2).max(40),
    text: z.string().trim().min(4).max(2000),
    availableFrom: z.enum(AVAIL).default('immediately'),
    chainIndex: z.number().int().min(0).max(50),
  })
  .strict()

/** 新增一個里程碑。 */
export const POST = handler(async (request: NextRequest) => {
  const gr = await gate()
  if ('res' in gr) return gr.res
  const body: unknown = await request.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)
  const input = parsed.data

  const admin = createAdminClient()
  if (!(await contentAllowed(admin, input.text)) || !(await contentAllowed(admin, input.title))) {
    return fail('UNPROCESSABLE', '這段文字沒通過內容安全過濾。')
  }

  const { data, error } = await admin
    .from('content_items')
    .insert({
      content_id: genId(),
      kind: 'chain',
      label: input.title,
      text: input.text,
      available_from: input.availableFrom,
      chain_index: input.chainIndex,
      enabled: true,
    } as never)
    .select('content_id, label, text, chain_index, available_from, enabled')
    .single()
  if (error || !data) {
    console.error('[admin/chain] 新增失敗', error?.message)
    return fail('INTERNAL', '新增失敗。')
  }
  return ok(data, undefined, 201)
})

const patchSchema = z
  .object({
    contentId: z.string().min(1).max(120),
    title: z.string().trim().min(2).max(40).optional(),
    text: z.string().trim().min(4).max(2000).optional(),
    availableFrom: z.enum(AVAIL).optional(),
    chainIndex: z.number().int().min(0).max(50).optional(),
    enabled: z.boolean().optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.title !== undefined ||
      v.text !== undefined ||
      v.availableFrom !== undefined ||
      v.chainIndex !== undefined ||
      v.enabled !== undefined,
    { message: '至少要改一項' },
  )

/** 編輯里程碑（標題／內文／解鎖條件／順序／啟用）。 */
export const PATCH = handler(async (request: NextRequest) => {
  const gr = await gate()
  if ('res' in gr) return gr.res
  const body: unknown = await request.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)
  const { contentId, title, text, availableFrom, chainIndex, enabled } = parsed.data

  const admin = createAdminClient()
  if (text !== undefined && !(await contentAllowed(admin, text))) return fail('UNPROCESSABLE', '這段文字沒通過內容安全過濾。')
  if (title !== undefined && !(await contentAllowed(admin, title))) return fail('UNPROCESSABLE', '標題沒通過內容安全過濾。')

  const patch: Record<string, unknown> = {}
  if (title !== undefined) patch.label = title
  if (text !== undefined) patch.text = text
  if (availableFrom !== undefined) patch.available_from = availableFrom
  if (chainIndex !== undefined) patch.chain_index = chainIndex
  if (enabled !== undefined) patch.enabled = enabled

  const { data, error } = await admin
    .from('content_items')
    .update(patch as never)
    .eq('content_id', contentId)
    .eq('kind', 'chain')
    .select('content_id')
    .maybeSingle()
  if (error) return fail('INTERNAL', '更新失敗。')
  if (!data) return fail('NOT_FOUND', '找不到這個里程碑。')
  return ok({ contentId, ...patch })
})

/** 刪除里程碑。 */
export const DELETE = handler(async (request: NextRequest) => {
  const gr = await gate()
  if ('res' in gr) return gr.res
  const contentId = new URL(request.url).searchParams.get('contentId')
  if (!contentId) return fail('VALIDATION_FAILED', '缺少 contentId。')
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('content_items')
    .delete()
    .eq('content_id', contentId)
    .eq('kind', 'chain')
    .select('content_id')
    .maybeSingle()
  if (error) return fail('INTERNAL', '刪除失敗。')
  if (!data) return fail('NOT_FOUND', '找不到這個里程碑。')
  return ok({ contentId, deleted: true })
})
