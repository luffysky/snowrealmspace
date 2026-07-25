import type { NextRequest } from 'next/server'
import { capturePatchSchema } from '@snowrealm/validation'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

/**
 * 處理一則 capture：
 *  - to_note：沉澱成一則筆記（notes 表），並標記 converted
 *  - archive：收起來（status=archived）
 *  - restore：放回 inbox
 */
export const PATCH = handler(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const result = await resolveContext()
  if (!result.ok) return fail(result.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '沒有存取權。')
  const { ctx } = result
  const { id } = await params
  const body: unknown = await request.json().catch(() => null)
  const parsed = capturePatchSchema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)

  // 先讀出這則（RLS：非成員查不到）
  const { data: cap } = await ctx.db
    .from('capture_inbox')
    .select('id, body, status')
    .eq('id', id)
    .eq('space_id', ctx.spaceId)
    .maybeSingle()
  if (!cap) return fail('NOT_FOUND', '找不到這則捕捉。')

  const nowIso = new Date().toISOString()

  if (parsed.data.action === 'to_note') {
    // 沉澱進空間：建一則筆記
    const { data: note, error: noteErr } = await ctx.db
      .from('notes')
      .insert({ space_id: ctx.spaceId, body: cap.body, created_by: ctx.userId })
      .select('id')
      .single()
    if (noteErr || !note) return fail('INTERNAL', '轉成筆記失敗。')
    const { error } = await ctx.db
      .from('capture_inbox')
      .update({ status: 'converted', processed_at: nowIso })
      .eq('id', id)
      .eq('space_id', ctx.spaceId)
    if (error) return fail('INTERNAL', '更新狀態失敗。')
    return ok({ id, status: 'converted', noteId: note.id })
  }

  const status = parsed.data.action === 'archive' ? 'archived' : 'inbox'
  const { error } = await ctx.db
    .from('capture_inbox')
    .update({ status, processed_at: status === 'archived' ? nowIso : null })
    .eq('id', id)
    .eq('space_id', ctx.spaceId)
  if (error) return fail('INTERNAL', '更新狀態失敗。')
  return ok({ id, status })
})

/** 徹底刪掉一則捕捉（硬刪除；inbox 是暫存性質，不需保留）。 */
export const DELETE = handler(async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const result = await resolveContext()
  if (!result.ok) return fail(result.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '沒有存取權。')
  const { ctx } = result
  const { id } = await params
  const { error } = await ctx.db.from('capture_inbox').delete().eq('id', id).eq('space_id', ctx.spaceId)
  if (error) return fail('INTERNAL', '刪除失敗。')
  return ok({ id, deleted: true })
})
