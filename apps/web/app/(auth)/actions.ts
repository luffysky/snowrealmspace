'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getDb } from '@/lib/supabase/server'
import { checkInvite, provisionSpaceForUser } from '@snowrealm/db/provisioning'
import { createAdminClient } from '@snowrealm/db/server'
import { emitEvent } from '@snowrealm/analytics'

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

const passwordSchema = z.string().min(8, '密碼至少 8 個字')

/**
 * 帳號密碼登入。
 *
 * 站台已有密碼閘門把關「誰能進站」，所以進站後的帳號登入不需要邀請。
 * 密碼登入不寄信 —— 這是 SMTP 還沒好時仍能登入的路徑。
 */
export async function signInWithPassword(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = emailSchema.safeParse(formData.get('email'))
  if (!email.success) return { status: 'error', message: '請輸入有效的 email' }
  const password = String(formData.get('password') ?? '')
  const next = (formData.get('next') as string | null) ?? '/home'

  const db = await getDb()
  const { error } = await db.auth.signInWithPassword({ email: email.data, password })
  if (error) {
    // 不區分「查無此人」與「密碼錯」—— 避免變成帳號查詢介面
    return { status: 'error', message: 'Email 或密碼不對。' }
  }
  redirect(next)
}

/**
 * 帳號密碼註冊。
 *
 * 用 admin 直接建立已確認 email 的帳號（跳過確認信），佈建 space，
 * 再以密碼登入。註冊後導去綁定頁，引導綁定 Google / LINE。
 */
export async function registerWithPassword(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const emailParsed = emailSchema.safeParse(formData.get('email'))
  if (!emailParsed.success) return { status: 'error', message: '請輸入有效的 email' }
  const passwordParsed = passwordSchema.safeParse(formData.get('password'))
  if (!passwordParsed.success) {
    return { status: 'error', message: passwordParsed.error.issues[0]?.message ?? '密碼太短' }
  }
  const email = emailParsed.data
  const password = passwordParsed.data

  const admin = createAdminClient()

  // 已存在就別重複建立 —— 引導去登入
  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (users?.users.some((u) => u.email?.toLowerCase() === email)) {
    return { status: 'error', message: '這個 email 已經註冊過了，直接登入即可。' }
  }

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // 跳過確認信（站台閘門已把關）
  })
  if (created.error || !created.data.user) {
    return { status: 'error', message: '建立帳號失敗，請再試一次。' }
  }

  try {
    const provisioned = await provisionSpaceForUser({ userId: created.data.user.id, email })
    if (provisioned.created) {
      await emitEvent('space.created', provisioned.spaceId, created.data.user.id, {
        spaceName: email.split('@')[0] ?? 'space',
        viaInvite: false,
      }).catch(() => {})
    }
  } catch {
    // 佈建失敗：把剛建的帳號刪掉，避免留下沒有 space 的孤兒
    await admin.auth.admin.deleteUser(created.data.user.id).catch(() => {})
    return { status: 'error', message: '建立空間時發生問題，請再試一次。' }
  }

  const db = await getDb()
  const { error } = await db.auth.signInWithPassword({ email, password })
  if (error) {
    return { status: 'error', message: '帳號建好了，但自動登入失敗，請手動登入。' }
  }

  // 進站後引導綁定 Google / LINE / 確認 email
  redirect('/settings/account?welcome=1')
}

export async function signOut(): Promise<never> {
  const db = await getDb()
  await db.auth.signOut()
  redirect('/login')
}
