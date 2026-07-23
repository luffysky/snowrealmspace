import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    // 設為目前使用中的版面
    activate: z.literal(true).optional(),
  })
  .strict()

/**
 * 更新版面：改名，或設為使用中（activate）。
 *
 * 「使用中」存在 `spaces.active_layout_id`，不是 layout 自己的欄位 ——
 * 一個 space 同時只有一個使用中版面，把狀態放在 space 上，
 * 就不會有「兩個 layout 都標記 active」的不一致可能。
 */
export const PATCH = handler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const result = await resolveContext()
  if (!result.ok) {
    if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
    return fail('FORBIDDEN', '你沒有這個空間的存取權。')
  }
  const { ctx } = result
  const { id } = await params

  const body: unknown = await request.json().catch(() => ({}))
  const parsed = patchSchema.safeParse(body ?? {})
  if (!parsed.success) return failValidation(parsed.error)

  // 確認版面屬於這個 space（RLS 也會擋，但明確查一次好回錯誤訊息）
  const { data: layout } = await ctx.db
    .from('layouts')
    .select('id')
    .eq('id', id)
    .eq('space_id', ctx.spaceId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!layout) return fail('NOT_FOUND', '找不到這個版面。')

  if (parsed.data.name !== undefined) {
    await ctx.db.from('layouts').update({ name: parsed.data.name }).eq('id', id)
  }

  if (parsed.data.activate) {
    await ctx.db.from('spaces').update({ active_layout_id: id }).eq('id', ctx.spaceId)
  }

  const { data: full } = await ctx.db
    .from('layouts')
    .select('*, widget_instances(*)')
    .eq('id', id)
    .maybeSingle()

    return ok(full)
  },
)

/**
 * 刪除版面（軟刪除）。
 *
 * 不能刪最後一個版面 —— 刪光了 Home 就沒有任何版面可顯示，
 * 而使用者沒有介面能重建。
 * 刪掉的若是使用中版面，把使用中切到另一個還存在的版面。
 */
export const DELETE = handler(
  async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const result = await resolveContext()
  if (!result.ok) {
    if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
    return fail('FORBIDDEN', '你沒有這個空間的存取權。')
  }
  const { ctx } = result
  const { id } = await params

  const { data: layouts } = await ctx.db
    .from('layouts')
    .select('id')
    .eq('space_id', ctx.spaceId)
    .is('deleted_at', null)

  const remaining = (layouts ?? []).filter((l) => l.id !== id)
  if (!layouts?.some((l) => l.id === id)) return fail('NOT_FOUND', '找不到這個版面。')
  if (remaining.length === 0) {
    return fail('VALIDATION_FAILED', '這是最後一個版面，不能刪除。至少要保留一個。')
  }

  await ctx.db
    .from('layouts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('space_id', ctx.spaceId)

  // 若刪的是使用中版面，切到第一個還在的
  const { data: space } = await ctx.db
    .from('spaces')
    .select('active_layout_id')
    .eq('id', ctx.spaceId)
    .maybeSingle()

  if (space?.active_layout_id === id) {
    await ctx.db
      .from('spaces')
      .update({ active_layout_id: remaining[0]!.id })
      .eq('id', ctx.spaceId)
    }

    return ok({ deleted: id, activeLayoutId: remaining[0]!.id })
  },
)
