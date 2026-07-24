import { redirect } from 'next/navigation'
import { cache } from 'react'
import { getDb } from '@/lib/supabase/server'
import { toSpaceRole, type Tables } from '@snowrealm/shared-types'

export type ActiveSpace = {
  space: Pick<Tables<'spaces'>, 'id' | 'name' | 'slug' | 'timezone' | 'privacy'>
  role: 'owner' | 'collaborator' | 'guest'
  settings: Tables<'space_settings'>
}

export type SessionUser = { id: string; email: string | null }

/**
 * 取得目前登入者。未登入回 null。
 * 用 React cache 包住，讓同一次 render 內多次呼叫只打一次 auth。
 */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const db = await getDb()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return null
  return { id: user.id, email: user.email ?? null }
})

export async function requireUser(): Promise<SessionUser> {
  const user = await getUser()
  if (!user) redirect('/login')
  return user
}

/**
 * 取得使用者目前的 space。
 *
 * 注意這裡用的是受 RLS 約束的 client：查詢結果本身就是「這個人能看到的 space」，
 * 不需要在應用層再過濾一次。若 RLS 寫錯，這裡會回傳空 —— 而不是回傳別人的資料。
 */
export const getActiveSpace = cache(async (): Promise<ActiveSpace | null> => {
  const user = await getUser()
  if (!user) return null

  const db = await getDb()

  const { data: membership } = await db
    .from('space_members')
    .select('space_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!membership) return null

  const { data: space } = await db
    .from('spaces')
    .select('id, name, slug, timezone, privacy')
    .eq('id', membership.space_id)
    // 軟刪除（等待寬限期清除）的 space 視同不存在 —— 不能再進去
    .is('deleted_at', null)
    .maybeSingle()

  if (!space) return null

  const { data: settings } = await db
    .from('space_settings')
    .select('*')
    .eq('space_id', space.id)
    .maybeSingle()

  if (!settings) return null

  return {
    space,
    role: toSpaceRole(membership.role),
    settings,
  }
})

export async function requireActiveSpace(): Promise<ActiveSpace> {
  await requireUser()
  const active = await getActiveSpace()
  // 登入了但沒有 space：佈建流程中斷過。送回 invite 頁重新完成。
  if (!active) redirect('/invite?state=missing-space')
  return active
}
