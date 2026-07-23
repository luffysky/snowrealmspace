'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireActiveSpace } from '@/lib/auth/session'
import { deleteInsight } from '@/lib/insights/engine'

const schema = z.object({ id: z.string().uuid() })

/** 刪除一則回顧。授權以 space_id 為準（ADR-006）。 */
export async function removeInsight(input: { id: string }) {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { ok: false as const }

  const { space } = await requireActiveSpace()
  await deleteInsight(space.id, parsed.data.id)
  revalidatePath('/insights')
  return { ok: true as const }
}
