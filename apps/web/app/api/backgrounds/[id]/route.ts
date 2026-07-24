import type { NextRequest } from 'next/server'
import { backgroundPatchSchema } from '@snowrealm/validation'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

const FIELD_MAP: Record<string, string> = {
  name: 'name',
  fit: 'fit',
  positionX: 'position_x',
  positionY: 'position_y',
  zoom: 'zoom',
  blur: 'blur',
  brightness: 'brightness',
  contrast: 'contrast',
  saturation: 'saturation',
  overlayColor: 'overlay_color',
  overlayOpacity: 'overlay_opacity',
  loop: 'loop',
  muted: 'muted',
  glassEnabled: 'glass_enabled',
  glassBlur: 'glass_blur',
  glassOpacity: 'glass_opacity',
  glassRadius: 'glass_radius',
  glassColor: 'glass_color',
  cropX: 'crop_x',
  cropY: 'crop_y',
  cropW: 'crop_w',
  cropH: 'crop_h',
  sceneId: 'scene_id',
  sceneDensity: 'scene_density',
  gradientSpec: 'gradient_spec',
}

export const PATCH = handler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const result = await resolveContext()
    if (!result.ok) return fail('UNAUTHENTICATED', '請先登入。')
    const { ctx } = result
    const { id } = await params

    const body: unknown = await request.json().catch(() => null)
    const parsed = backgroundPatchSchema.safeParse(body)
    if (!parsed.success) return failValidation(parsed.error)

    const patch: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(parsed.data)) {
      const column = FIELD_MAP[key]
      if (column !== undefined) patch[column] = value
    }

    if (Object.keys(patch).length === 0) {
      return fail('VALIDATION_FAILED', '沒有要更新的欄位。')
    }

    const { data, error } = await ctx.db
      .from('background_items')
      .update(patch as never)
      .eq('id', id)
      .eq('space_id', ctx.spaceId)
      .is('deleted_at', null)
      .select('*')
      .maybeSingle()

    if (error) {
      console.error('[backgrounds] 更新失敗', error.message)
      return fail('INTERNAL', '無法更新背景。')
    }
    if (!data) return fail('NOT_FOUND', '找不到這個背景。')
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
      .from('background_items')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('space_id', ctx.spaceId)

    if (error) return fail('INTERNAL', '無法刪除背景。')
    return ok({ id, deleted: true })
  },
)
