import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/supabase/server'
import { consumeTransaction, exchangeAndVerify } from '@snowrealm/db/line-oauth'
import {
  upsertIdentity,
  findUserByIdentity,
  touchIdentity,
  primarySpaceIdOf,
} from '@snowrealm/db/identities'
import { mintSessionForUser } from '@snowrealm/db/session-mint'
import { audit } from '@snowrealm/analytics'

export const dynamic = 'force-dynamic'

/**
 * LINE 授權回呼。
 *
 * 順序不可調換：
 *   1. 先消耗 state（原子性，只能成功一次）→ 擋 CSRF 與重放
 *   2. 再用 code 換 token 並驗證 id_token 簽章 + nonce
 *   3. 最後才碰資料庫
 *
 * 任何一步失敗都導回並帶上原因，**不繼續往下走**。
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const origin = url.origin
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state') ?? ''
  const lineError = url.searchParams.get('error')

  // 使用者在 LINE 授權頁按了取消
  if (lineError) {
    return NextResponse.redirect(new URL('/settings/account?error=line_cancelled', origin))
  }

  const tx = await consumeTransaction(state)
  if (!tx) {
    // state 無效／已用過／逾時。全都導回同一個訊息 ——
    // 分別回報等於告訴攻擊者哪一種猜對了。
    return NextResponse.redirect(new URL('/login?error=line_state_invalid', origin))
  }

  const back = tx.redirectTo ?? (tx.intent === 'link' ? '/settings/account' : '/home')

  if (!code) {
    return NextResponse.redirect(new URL(`${back}?error=line_missing_code`, origin))
  }

  const verified = await exchangeAndVerify(code, tx.nonce)
  if (!verified.ok) {
    console.error('[auth/line/callback] 驗證失敗', verified.reason)
    return NextResponse.redirect(new URL(`${back}?error=line_${verified.reason}`, origin))
  }

  const profile = verified.profile

  // ── 綁定 ────────────────────────────────────────────────
  if (tx.intent === 'link') {
    if (!tx.userId) {
      return NextResponse.redirect(new URL('/login?error=line_no_session', origin))
    }

    const result = await upsertIdentity({
      userId: tx.userId,
      provider: 'line',
      providerUid: profile.userId,
      email: profile.emailVerified ? profile.email : null,
      displayName: profile.displayName,
      avatarUrl: profile.pictureUrl,
      lineUserId: profile.userId,
    })

    if (!result.ok) {
      return NextResponse.redirect(new URL(`${back}?error=link_taken&provider=line`, origin))
    }

    await audit({
      spaceId: await primarySpaceIdOf(tx.userId),
      actorId: tx.userId,
      action: 'identity.linked',
      entityType: 'user_identity',
      entityId: result.identity.id,
      after: { provider: 'line' },
      ip: request.headers.get('x-forwarded-for') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    }).catch(() => {})

    return NextResponse.redirect(new URL(`${back}?linked=line`, origin))
  }

  // ── 登入 ────────────────────────────────────────────────
  const owner = await findUserByIdentity('line', profile.userId)

  // §6：LINE 不支援註冊。沒綁過就是沒綁過，不在這裡建帳號 ——
  // 建了也進不去（沒有 space、沒有邀請），只會留下孤兒使用者。
  if (!owner) {
    return NextResponse.redirect(new URL('/login?error=line_not_linked', origin))
  }

  const db = await getDb()
  const minted = await mintSessionForUser(db, owner.userId)
  if (!minted.ok) {
    console.error('[auth/line/callback] session 建立失敗', minted.reason)
    return NextResponse.redirect(new URL('/login?error=line_session_failed', origin))
  }

  await touchIdentity('line', profile.userId).catch(() => {})

  return NextResponse.redirect(new URL(back, origin))
}
