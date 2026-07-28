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
import { createAdminClient } from '@snowrealm/db/server'
import { provisionSpaceForUser } from '@snowrealm/db/provisioning'
import { audit, emitEvent } from '@snowrealm/analytics'
import { appUrl } from '@/lib/app-url'
import { isEnabled } from '@/lib/flags'

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
  // 重導基底用對外網址（APP_PUBLIC_URL），不用 request host（Zeabur 內是 localhost:8080）
  const origin = appUrl()
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

  // 沒綁過這個 LINE 帳號時：
  //   - openRegistration 關閉 → 維持邀請制（§6：LINE 不支援註冊）。
  //   - openRegistration 開啟 → 以 LINE profile 直接註冊一個新帳號並佈建 space。
  if (!owner) {
    if (!(await isEnabled('openRegistration'))) {
      return NextResponse.redirect(new URL('/login?error=line_not_linked', origin))
    }
    return await registerFromLine(request, profile, back, origin)
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

/**
 * openRegistration 開啟時，用 LINE profile 建立新帳號並佈建 space。
 *
 * 安全性：此函式只在「已通過 state 消耗 + id_token 驗證」之後才被呼叫，
 * 不觸碰任何 CSRF/nonce/session 驗證。session 一律走 mintSessionForUser。
 */
async function registerFromLine(
  request: NextRequest,
  profile: { userId: string; displayName: string | null; pictureUrl: string | null; email: string | null; emailVerified: boolean },
  back: string,
  origin: string,
): Promise<NextResponse> {
  const admin = createAdminClient()

  // LINE 已驗證的 email 才可用（§5：未驗證 email 不可用於自動合併）。
  // 沒有可用 email 時退回合成 email（沿用 actions.ts 的合成 email 慣例）。
  const email = profile.emailVerified && profile.email ? profile.email.toLowerCase() : `line_${profile.userId}@line.snowrealm.pet`

  let userId: string
  let createdNow = false

  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { display_name: profile.displayName },
  })

  if (created.error || !created.data.user) {
    // email 已被占用（真實 email 已註冊過）→ 沿用既有帳號、把 LINE 綁上去，
    // 不當機也不重複建立。找不到就真的失敗。
    const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
    const existing = users?.users.find((u) => u.email?.toLowerCase() === email)
    if (!existing) {
      console.error('[auth/line/callback] 建立帳號失敗', created.error?.message)
      return NextResponse.redirect(new URL('/login?error=line_register_failed', origin))
    }
    userId = existing.id
  } else {
    userId = created.data.user.id
    createdNow = true
  }

  try {
    const result = await upsertIdentity({
      userId,
      provider: 'line',
      providerUid: profile.userId,
      email: profile.emailVerified ? profile.email : null,
      displayName: profile.displayName,
      avatarUrl: profile.pictureUrl,
      lineUserId: profile.userId,
    })
    if (!result.ok) {
      // 這個 LINE 帳號已綁在別人身上（理論上不會走到這，findUserByIdentity 應已命中）。
      throw new Error('line_identity_taken')
    }

    const provisioned = await provisionSpaceForUser({
      userId,
      email,
      displayName: profile.displayName,
    })
    if (provisioned.created) {
      await emitEvent('space.created', provisioned.spaceId, userId, {
        spaceName: 'line',
        viaInvite: false,
      })
    }
  } catch (err: unknown) {
    console.error('[auth/line/callback] 自助註冊佈建失敗', err)
    // 只清掉「這次才新建」的帳號，避免留下半套孤兒；沿用既有帳號的不刪。
    if (createdNow) await admin.auth.admin.deleteUser(userId).catch(() => {})
    return NextResponse.redirect(new URL('/login?error=line_register_failed', origin))
  }

  const db = await getDb()
  const minted = await mintSessionForUser(db, userId)
  if (!minted.ok) {
    console.error('[auth/line/callback] 註冊後 session 建立失敗', minted.reason)
    return NextResponse.redirect(new URL('/login?error=line_session_failed', origin))
  }

  await touchIdentity('line', profile.userId).catch(() => {})

  await audit({
    spaceId: await primarySpaceIdOf(userId),
    actorId: userId,
    action: 'space.created',
    entityType: 'space',
    after: { via: 'line_register' },
    ip: request.headers.get('x-forwarded-for') ?? undefined,
    userAgent: request.headers.get('user-agent') ?? undefined,
  }).catch(() => {})

  return NextResponse.redirect(new URL(back, origin))
}
