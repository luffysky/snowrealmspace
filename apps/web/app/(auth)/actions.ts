'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getDb } from '@/lib/supabase/server'
import { checkInvite } from '@snowrealm/db/provisioning'
import { createAdminClient } from '@snowrealm/db/server'

const emailSchema = z.string().trim().toLowerCase().email('請輸入有效的 email')

export type AuthActionState = {
  status: 'idle' | 'sent' | 'error'
  message?: string
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}

/**
 * 寄送 magic link。
 *
 * ADR-003：Alpha 期間不開放自由註冊。
 *   - 已有 space 的使用者 → 正常寄送（一般登入）
 *   - 沒有 space 的使用者 → 必須帶有效邀請 token
 *
 * 注意回應措辭：不論 email 是否存在都回相同訊息，
 * 避免這個端點變成「哪些 email 有帳號」的查詢介面。
 */
export async function sendMagicLink(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = emailSchema.safeParse(formData.get('email'))
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? '請輸入有效的 email' }
  }
  const email = parsed.data
  const inviteToken = (formData.get('invite') as string | null)?.trim() || null
  const next = (formData.get('next') as string | null) ?? '/home'

  const admin = createAdminClient()

  // 這個 email 是否已經是某個 space 的成員？
  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  const existingUser = users?.users.find((u) => u.email?.toLowerCase() === email)

  let isExistingMember = false
  if (existingUser) {
    const { data: membership } = await admin
      .from('space_members')
      .select('space_id')
      .eq('user_id', existingUser.id)
      .limit(1)
      .maybeSingle()
    isExistingMember = Boolean(membership)
  }

  if (!isExistingMember) {
    if (!inviteToken) {
      return {
        status: 'error',
        message: '目前為邀請制。請使用你收到的邀請連結進入。',
      }
    }
    const check = await checkInvite(inviteToken, email)
    if (!check.ok) {
      const reasons: Record<string, string> = {
        not_found: '邀請連結無效。',
        expired: '邀請連結已過期，請索取新的。',
        already_accepted: '這個邀請已經被使用過了。',
        email_mismatch: '這個邀請是給另一個 email 的。',
      }
      return { status: 'error', message: reasons[check.reason] ?? '邀請連結無效。' }
    }
  }

  const callback = new URL('/auth/callback', appUrl())
  callback.searchParams.set('next', next)
  if (inviteToken && !isExistingMember) callback.searchParams.set('invite', inviteToken)

  const db = await getDb()
  const { error } = await db.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callback.toString(),
      shouldCreateUser: true,
    },
  })

  if (error) {
    return { status: 'error', message: '寄送失敗，請稍後再試。' }
  }

  return {
    status: 'sent',
    message: `登入連結已寄到 ${email}。連結 1 小時內有效。`,
  }
}

export async function signOut(): Promise<never> {
  const db = await getDb()
  await db.auth.signOut()
  redirect('/login')
}
