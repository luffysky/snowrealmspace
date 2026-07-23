'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireActiveSpace } from '@/lib/auth/session'
import { setSurpriseFavorite } from '@/lib/daily/surprise'

const schema = z.object({ id: z.string().uuid(), favorited: z.boolean() })

/** 收藏 / 取消收藏一則開過的驚喜。授權以 space_id 為準（ADR-006）。 */
export async function toggleSurpriseFavorite(input: { id: string; favorited: boolean }) {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { ok: false as const }

  const { space } = await requireActiveSpace()
  await setSurpriseFavorite(space.id, parsed.data.id, parsed.data.favorited)
  revalidatePath('/surprises')
  return { ok: true as const }
}
