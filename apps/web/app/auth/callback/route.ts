import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/supabase/server'
import {
  checkInvite,
  provisionSpaceForUser,
  markInviteAccepted,
  joinExistingSpace,
} from '@snowrealm/db/provisioning'
import { createAdminClient } from '@snowrealm/db/server'
import { emitEvent, audit } from '@snowrealm/analytics'
import { toSpaceRole } from '@snowrealm/shared-types'

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

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', url.origin))
  }

  const db = await getDb()
  const { data: exchanged, error: exchangeError } = await db.auth.exchangeCodeForSession(code)

  if (exchangeError || !exchanged.user) {
    return NextResponse.redirect(new URL('/login?error=invalid_link', url.origin))
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
    return NextResponse.redirect(new URL(next, url.origin))
  }

  // 尚無 space → 必須有有效邀請才能繼續。
  if (!inviteToken) {
    await db.auth.signOut()
    return NextResponse.redirect(new URL('/login?error=invite_required', url.origin))
  }

  const check = await checkInvite(inviteToken, email)
  if (!check.ok) {
    await db.auth.signOut()
    return NextResponse.redirect(new URL(`/login?error=invite_${check.reason}`, url.origin))
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

    return NextResponse.redirect(new URL(next, url.origin))
  } catch (err: unknown) {
    console.error('[auth/callback] 佈建失敗', err)
    await db.auth.signOut()
    return NextResponse.redirect(new URL('/login?error=provisioning_failed', url.origin))
  }
}
