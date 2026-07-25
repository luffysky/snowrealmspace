import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

/**
 * 隨手記的雲端儲存。一個 quick_note widget instance 對一則筆記。
 * 走 getDb()（受 RLS 約束）—— 一般成員請求，不是系統代算。
 */

export const dynamic = 'force-dynamic'

const noteSchema = z.object({ body: z.string().max(10_000) })

export const GET = handler(
  async (_request: NextRequest, { params }: { params: Promise<{ instanceId: string }> }) => {
    const result = await resolveContext()
    if (!result.ok) {
      if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
      return fail('FORBIDDEN', '你沒有這個空間的存取權。')
    }
    const { ctx } = result
    const { instanceId } = await params

    const { data, error } = await ctx.db
      .from('widget_notes')
      .select('body, updated_at')
      .eq('instance_id', instanceId)
      .maybeSingle()

    if (error) {
      console.error('[widget-notes] 讀取失敗', error.message)
      return fail('INTERNAL', '無法載入筆記。')
    }
    return ok({ body: data?.body ?? '', updatedAt: data?.updated_at ?? null })
  },
)

export const PUT = handler(
  async (request: NextRequest, { params }: { params: Promise<{ instanceId: string }> }) => {
    const result = await resolveContext()
    if (!result.ok) {
      if (result.reason === 'unauthenticated') return fail('UNAUTHENTICATED', '請先登入。')
      return fail('FORBIDDEN', '你沒有這個空間的存取權。')
    }
    const { ctx } = result
    const { instanceId } = await params

    const raw: unknown = await request.json().catch(() => null)
    const parsed = noteSchema.safeParse(raw)
    if (!parsed.success) return failValidation(parsed.error)

    // instance 必須屬於這個 space（RLS 也會擋，但要回明確的 404）
    const { data: instance } = await ctx.db
      .from('widget_instances')
      .select('id')
      .eq('id', instanceId)
      .eq('space_id', ctx.spaceId)
      .maybeSingle()
    if (!instance) return fail('NOT_FOUND', '找不到這個區塊。')

    const { data, error } = await ctx.db
      .from('widget_notes')
      .upsert(
        { instance_id: instanceId, space_id: ctx.spaceId, body: parsed.data.body } as never,
        { onConflict: 'instance_id' },
      )
      .select('updated_at')
      .single()

    if (error || !data) {
      console.error('[widget-notes] 儲存失敗', error?.message)
      return fail('INTERNAL', '無法儲存筆記。')
    }
    return ok({ updatedAt: data.updated_at })
  },
)
