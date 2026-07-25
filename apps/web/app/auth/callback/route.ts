import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/supabase/server'
import {
  checkInvite,
  provisionSpaceForUser,
  markInviteAccepted,
  joinExistingSpace,
} from '@snowrealm/db/provisioning'
import { createAdminClient } from '@snowrealm/db/server'
import { syncFromAuthIdentities } from '@snowrealm/db/identities'
import { emitEvent, audit } from '@snowrealm/analytics'
import { toSpaceRole } from '@snowrealm/shared-types'
import { appUrl } from '@/lib/app-url'

/**
 * Magic link 回呼。
 *
 * ADR-003：Alpha 期間 sign-up 關閉。未受邀 email 即使拿到有效的
 * magic link 也不能取得 space —— 這裡是那道閘門。
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const code = url.searchParams.get('code')
  const inviteToken = url.searchParams.get('invite')
  const next = url.searchParams.get('next') ?? '/home'

  // 重導一律用對外網址基底（APP_PUBLIC_URL），不用 request host ——
  // 否則容器／代理後面會把人導到內部的 :8080。
  const base = appUrl()

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', base))
  }

  const db = await getDb()
  const { data: exchanged, error: exchangeError } = await db.auth.exchangeCodeForSession(code)

  if (exchangeError || !exchanged.user) {
    return NextResponse.redirect(new URL('/login?error=invalid_link', base))
  }

  const user = exchanged.user
  const email = user.email ?? ''

  // 已經是某個 space 的成員 → 一般登入，直接放行。
  const admin = createAdminClient()
  const { data: existingMembership } = await admin
    .from('space_members')
    .select('space_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (existingMembership) {
    // 用 Google 登入時 auth.identities 可能剛新增一筆，把投影表補上。
    // 失敗不阻擋登入 —— 這只是設定頁的顯示資料。
    await syncFromAuthIdentities(user.id).catch((err: unknown) => {
      console.error('[auth/callback] 身分同步失敗', err)
    })
    return NextResponse.redirect(new URL(next, base))
  }

  // 尚無 space → 必須有有效邀請才能繼續。
  if (!inviteToken) {
    await db.auth.signOut()
    return NextResponse.redirect(new URL('/login?error=invite_required', base))
  }

  const check = await checkInvite(inviteToken, email)
  if (!check.ok) {
    await db.auth.signOut()
    return NextResponse.redirect(new URL(`/login?error=invite_${check.reason}`, base))
  }

  const invite = check.invite

  try {
    let spaceId: string

    if (invite.space_id) {
      // 加入既有 space
      await joinExistingSpace({
        spaceId: invite.space_id,
        userId: user.id,
        role: toSpaceRole(invite.role),
      })
      spaceId = invite.space_id
    } else {
      // 建立新 space（含 settings 與 agent profile）
      const provisioned = await provisionSpaceForUser({
        userId: user.id,
        email,
        displayName: (user.user_metadata?.['display_name'] as string | undefined) ?? null,
      })
      spaceId = provisioned.spaceId

      if (provisioned.created) {
        await emitEvent('space.created', spaceId, user.id, {
          spaceName: email.split('@')[0] ?? 'space',
          viaInvite: true,
        })
      }
    }

    await markInviteAccepted(invite.id, user.id)

    // 新帳號也要有一筆 email 身分，否則「至少保留一種登入方式」
    // 的計數會從 0 開始，綁了 Google 之後就能把自己鎖在外面。
    await syncFromAuthIdentities(user.id).catch(() => {})

    await audit({
      spaceId,
      actorId: user.id,
      action: 'invite.accepted',
      entityType: 'space_invite',
      entityId: invite.id,
      after: { role: toSpaceRole(invite.role) },
      ip: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    })

    return NextResponse.redirect(new URL(next, base))
  } catch (err: unknown) {
    console.error('[auth/callback] 佈建失敗', err)
    await db.auth.signOut()
    return NextResponse.redirect(new URL('/login?error=provisioning_failed', base))
  }
}
