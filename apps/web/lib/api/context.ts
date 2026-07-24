import { headers } from 'next/headers'
import { getDb } from '@/lib/supabase/server'
import { toSpaceRole, type SpaceRole } from '@snowrealm/shared-types'
import type { Db } from '@snowrealm/db/server'

/**
 * API 請求的 space 範圍解析。
 *
 * 04-api-contract.md §0：space id 一律從 `X-Space-Id` header 取，
 * **絕不從 body 或 query 取** —— 那會讓 IDOR 攻擊面暴露在請求體，
 * 且容易在某個端點忘記驗證。
 */

export type ApiContext = {
  db: Db
  userId: string
  spaceId: string
  role: SpaceRole
}

export type ContextResult =
  | { ok: true; ctx: ApiContext }
  | { ok: false; reason: 'unauthenticated' | 'missing_space' | 'forbidden' }

export async function resolveContext(): Promise<ContextResult> {
  const db = await getDb()

  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return { ok: false, reason: 'unauthenticated' }

  const headerList = await headers()
  const spaceId = headerList.get('x-space-id')
  if (!spaceId) return { ok: false, reason: 'missing_space' }

  // 用受 RLS 約束的 client 查詢 —— 不是成員就查不到，不需要額外檢查
  const { data: membership } = await db
    .from('space_members')
    .select('role')
    .eq('space_id', spaceId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) return { ok: false, reason: 'forbidden' }

  // 軟刪除（等待寬限期清除）的 space 不可再操作 —— 與 session 的 getActiveSpace 一致，
  // 否則使用者刪了空間、被導去 /invite，卻還能透過 API 繼續在裡面寫東西。
  const { data: space } = await db
    .from('spaces')
    .select('id')
    .eq('id', spaceId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!space) return { ok: false, reason: 'forbidden' }

  return {
    ok: true,
    ctx: { db, userId: user.id, spaceId, role: toSpaceRole(membership.role) },
  }
}

/** 給沒有 X-Space-Id 的端點用（例如列出使用者可存取的所有 space）。 */
export async function resolveUser(): Promise<{ db: Db; userId: string } | null> {
  const db = await getDb()
  const {
    data: { user },
  } = await db.auth.getUser()
  return user ? { db, userId: user.id } : null
}
