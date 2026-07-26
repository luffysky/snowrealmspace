import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/supabase/server'
import { requireActiveSpace } from '@/lib/auth/session'
import { ok, fail, failValidation, handler } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

const schema = z
  .object({ name: z.string().trim().min(1, '名稱不可空白').max(80, '名稱最多 80 字') })
  .strict()

/**
 * 改目前空間的名稱。
 *
 * 空間 id 一律取自 session（requireActiveSpace），不吃 client 傳來的 id —— 避免
 * 拿別人的 space id 來改名。授權雙保險：這裡擋非 owner，DB 的
 * `owner writes space` RLS 再擋一次（用 getDb 受 RLS 約束的 client）。
 */
export const PATCH = handler(async (request: NextRequest) => {
  const { space, role } = await requireActiveSpace()
  if (role !== 'owner') return fail('FORBIDDEN', '只有空間擁有者可以改名。')

  const body: unknown = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)

  const db = await getDb()
  const { data, error } = await db
    .from('spaces')
    .update({ name: parsed.data.name } as never)
    .eq('id', space.id)
    .select('name')
    .maybeSingle()
  if (error) return fail('INTERNAL', '更新失敗。')
  if (!data) return fail('FORBIDDEN', '沒有權限更新這個空間。')

  return ok({ name: data.name })
})
