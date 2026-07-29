import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

// 漸層染色：兩個 #RRGGBB 色停 + 角度。null = 清除染色（回原始 emoji 配色）。
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, '顏色需為 #RRGGBB。')
const tintSchema = z
  .object({
    from: hex,
    to: hex,
    angle: z.number().min(0).max(360),
  })
  .nullable()

// 全部可選；每項各自範圍校驗。位置照樣夾在 0..1。
const patchSchema = z.object({
  x: z.number().min(0).max(1).optional(),
  y: z.number().min(0).max(1).optional(),
  scale: z.number().min(0.3).max(3).optional(),
  rotation: z.number().optional(),
  opacity: z.number().min(0.1).max(1).optional(),
  tint: tintSchema.optional(),
  zIndex: z.number().int().min(-999).max(999).optional(),
  // 釘選：切換時前端會連同轉換後的 x/y 一起送，維持裝飾在畫面上原位。
  pinned: z.boolean().optional(),
})

// camelCase 輸入 → snake_case 欄位。tint 直接當 jsonb 存。
const FIELD_MAP: Record<string, string> = {
  x: 'x',
  y: 'y',
  scale: 'scale',
  rotation: 'rotation',
  opacity: 'opacity',
  tint: 'tint',
  zIndex: 'z_index',
  pinned: 'pinned',
}

export const PATCH = handler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const result = await resolveContext()
    if (!result.ok) return fail('UNAUTHENTICATED', '請先登入。')
    const { ctx } = result
    const { id } = await params

    const body: unknown = await request.json().catch(() => null)
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) return failValidation(parsed.error)

    const patch: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value === undefined) continue
      const column = FIELD_MAP[key]
      if (column !== undefined) patch[column] = value
    }

    if (Object.keys(patch).length === 0) {
      return fail('VALIDATION_FAILED', '沒有要更新的欄位。')
    }

    const { data, error } = await ctx.db
      .from('space_decorations')
      .update(patch as never)
      .eq('id', id)
      .eq('space_id', ctx.spaceId)
      .select('*')
      .maybeSingle()

    if (error) {
      console.error('[decorations] 更新失敗', error.message)
      return fail('INTERNAL', '無法更新裝飾品。')
    }
    if (!data) return fail('NOT_FOUND', '找不到這個裝飾品。')
    return ok(data)
  },
)

export const DELETE = handler(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const result = await resolveContext()
    if (!result.ok) return fail('UNAUTHENTICATED', '請先登入。')
    const { ctx } = result
    const { id } = await params

    const { error } = await ctx.db
      .from('space_decorations')
      .delete()
      .eq('id', id)
      .eq('space_id', ctx.spaceId)

    if (error) {
      console.error('[decorations] 刪除失敗', error.message)
      return fail('INTERNAL', '無法移除裝飾品。')
    }
    return ok({ id, deleted: true })
  },
)
