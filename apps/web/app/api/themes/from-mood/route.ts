import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { paletteFromMood, buildThemesFromPalette } from '@snowrealm/theme-engine'
import { resolveContext } from '@/lib/api/context'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

const schema = z.object({ mood: z.string().trim().min(1).max(40) }).strict()

/**
 * AI 配色：由心情/關鍵字生一組主題變體（明亮/柔和/深色）。純本地演算法（無 AI 廠商），
 * 對比由 buildThemesFromPalette 保證。回傳 variant + 完整 definition，前端套進草稿。
 */
export const POST = handler(async (request: NextRequest) => {
  const result = await resolveContext()
  if (!result.ok) return fail(result.reason === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN', '沒有存取權。')
  const body: unknown = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)

  const variants = buildThemesFromPalette(paletteFromMood(parsed.data.mood), parsed.data.mood)
  return ok({ variants })
})
