import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { compileFilterPatterns, passesContentFilterWith } from '@snowrealm/validation'
import { checkSiteAdmin } from '@/lib/auth/site-admin'
import { createAdminClient, type Db } from '@snowrealm/db/server'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

const KINDS = ['quote', 'prompt', 'question', 'micro_action', 'seasonal', 'milestone', 'welcome', 'greeting', 'surprise', 'chain'] as const

const postSchema = z
  .object({
    kind: z.enum(['quote', 'prompt', 'question', 'micro_action', 'seasonal', 'milestone', 'welcome', 'greeting', 'surprise']),
    text: z.string().trim().min(2).max(500),
    weight: z.number().positive().max(10).default(1),
    label: z.string().trim().max(24).optional(),
    rarity: z.enum(['common', 'uncommon', 'rare', 'special', 'anniversary']).optional(),
    greetingSlot: z.enum(['morning', 'afternoon', 'evening', 'night']).optional(),
    estimatedMinutes: z.number().int().min(1).max(120).optional(),
    tags: z.array(z.string().regex(/^[a-z_]+$/)).max(6).optional(),
  })
  .strict()

const patchSchema = z
  .object({
    contentId: z.string().min(1).max(120),
    enabled: z.boolean().optional(),
    text: z.string().trim().min(2).max(500).optional(),
    weight: z.number().positive().max(10).optional(),
  })
  .strict()
  .refine((v) => v.enabled !== undefined || v.text !== undefined || v.weight !== undefined, { message: '至少要改一項' })

async function gate() {
  const g = await checkSiteAdmin()
  if (!g.ok) return { res: fail(g.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '需要站台管理員身份。') }
  return { g }
}

/**
 * 分頁列出某一類的內容。後台不再一次拉全部（PostgREST 上限 1000 + 池有上萬則），
 * 改成「展開某類才拉那一頁」，並回傳該類的**真實總數**（count exact）。
 */
export const GET = handler(async (request: NextRequest) => {
  const gr = await gate()
  if ('res' in gr) return gr.res

  const url = new URL(request.url)
  const kind = url.searchParams.get('kind') ?? ''
  const q = (url.searchParams.get('q') ?? '').trim()
  const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0)
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit')) || 100))
  if (!(KINDS as readonly string[]).includes(kind)) return fail('VALIDATION_FAILED', 'kind 不正確。')

  const admin = createAdminClient()
  let query = admin
    .from('content_items')
    .select('content_id, kind, label, text, enabled, weight, rarity, tags', { count: 'exact' })
    .eq('kind', kind)
  if (q) query = query.ilike('text', `%${q}%`)
  const { data, error, count } = await query
    .order('weight', { ascending: false })
    .order('content_id', { ascending: true })
    .range(offset, offset + limit - 1)
  if (error) return fail('INTERNAL', '讀取失敗。')
  return ok({ items: data ?? [], total: count ?? 0, offset, limit })
})

/** 內容文字要過安全過濾（底線 + 後台附加），與一般寫入同標準。 */
async function contentAllowed(admin: Db, text: string): Promise<boolean> {
  const { data } = await admin.from('content_filter_patterns').select('pattern').eq('enabled', true)
  const extra = compileFilterPatterns((data ?? []).map((r) => r.pattern))
  return passesContentFilterWith(text, extra)
}

function genId(kind: string): string {
  const rand = Array.from({ length: 8 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('')
  return `admin-${kind}-${rand}`
}

/** 新增內容。 */
export const POST = handler(async (request: NextRequest) => {
  const gr = await gate()
  if ('res' in gr) return gr.res

  const body: unknown = await request.json().catch(() => null)
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)
  const input = parsed.data

  if (input.kind === 'surprise' && !input.label) return fail('UNPROCESSABLE', '驚喜需要盒子外觀文字（label）。')

  const admin = createAdminClient()
  if (!(await contentAllowed(admin, input.text))) return fail('UNPROCESSABLE', '這段文字沒通過內容安全過濾。')

  const { data, error } = await admin
    .from('content_items')
    .insert({
      content_id: genId(input.kind),
      kind: input.kind,
      text: input.text,
      weight: input.weight,
      label: input.label ?? null,
      rarity: input.kind === 'surprise' ? (input.rarity ?? 'common') : null,
      greeting_slot: input.kind === 'greeting' ? (input.greetingSlot ?? 'morning') : null,
      estimated_minutes:
        input.kind === 'prompt' || input.kind === 'micro_action' ? (input.estimatedMinutes ?? null) : null,
      tags: input.tags ?? [],
      enabled: true,
    } as never)
    .select('content_id, kind, label, text, enabled, weight, rarity, tags')
    .single()
  if (error || !data) {
    console.error('[content] 新增失敗', error?.message)
    return fail('INTERNAL', '新增失敗。')
  }
  return ok(data, undefined, 201)
})

/** 審核／編輯：啟用停用、改文字、改權重。 */
export const PATCH = handler(async (request: NextRequest) => {
  const gr = await gate()
  if ('res' in gr) return gr.res

  const body: unknown = await request.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)
  const { contentId, enabled, text, weight } = parsed.data

  const admin = createAdminClient()
  if (text !== undefined && !(await contentAllowed(admin, text))) {
    return fail('UNPROCESSABLE', '這段文字沒通過內容安全過濾。')
  }

  const patch: Record<string, unknown> = {}
  if (enabled !== undefined) patch.enabled = enabled
  if (text !== undefined) patch.text = text
  if (weight !== undefined) patch.weight = weight

  const { data, error } = await admin
    .from('content_items')
    .update(patch as never)
    .eq('content_id', contentId)
    .select('content_id')
    .maybeSingle()
  if (error) return fail('INTERNAL', '更新失敗。')
  if (!data) return fail('NOT_FOUND', '找不到這則內容。')
  return ok({ contentId, ...patch })
})

/** 刪除一則內容。 */
export const DELETE = handler(async (request: NextRequest) => {
  const gr = await gate()
  if ('res' in gr) return gr.res

  const contentId = new URL(request.url).searchParams.get('contentId')
  if (!contentId) return fail('VALIDATION_FAILED', '缺少 contentId。')
  // 生日鏈等系統內容不給隨手刪
  if (contentId.startsWith('chain-')) return fail('UNPROCESSABLE', '系統內容（生日鏈）不可從這裡刪除。')

  const admin = createAdminClient()
  const { error } = await admin.from('content_items').delete().eq('content_id', contentId)
  if (error) return fail('INTERNAL', '刪除失敗。')
  return ok({ contentId, deleted: true })
})
