import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/supabase/server'
import {
  listIdentities,
  unlinkIdentity,
  syncFromAuthIdentities,
  primarySpaceIdOf,
} from '@snowrealm/db/identities'
import { audit } from '@snowrealm/analytics'

export const dynamic = 'force-dynamic'

/** 目前登入者已綁定的登入方式。 */
export async function GET() {
  const db = await getDb()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: { message: '未登入' } }, { status: 401 })
  }

  await syncFromAuthIdentities(user.id)
  return NextResponse.json({ data: { identities: await listIdentities(user.id) } })
}

/**
 * 解綁。
 *
 * 用 POST 而不是 DELETE /:id：解綁 Google 時除了刪我們的投影，
 * 還要呼叫 Supabase 的 `unlinkIdentity`，兩件事必須一起做完，
 * 語意上是一個動作而不是刪一筆資料。
 */
export async function POST(request: NextRequest) {
  const db = await getDb()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: { message: '未登入' } }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as { identityId?: string } | null
  const identityId = body?.identityId
  if (!identityId) {
    return NextResponse.json({ error: { message: '缺少 identityId' } }, { status: 400 })
  }

  const current = await listIdentities(user.id)
  const target = current.find((i) => i.id === identityId)
  if (!target) {
    return NextResponse.json({ error: { message: '找不到這個登入方式' } }, { status: 404 })
  }

  // ⚠️ 順序不可調換：先擋「最後一種方式」，再做 Supabase 的解綁。
  //
  // 反過來寫的話，Supabase 會先因為自己的限制回錯，使用者看到的是
  // 「Supabase 解綁失敗」這種毫無意義的訊息，而不是真正的原因
  // 「這是你唯一的登入方式」。而且 Supabase 的解綁不可逆 ——
  // 不該在一個注定要被拒絕的請求上先動它。
  if (current.length <= 1) {
    return NextResponse.json(
      {
        error: {
          message: '這是你唯一的登入方式，解除後就進不來了。請先綁定另一種方式。',
          code: 'last_method',
        },
      },
      { status: 409 },
    )
  }

  // Supabase 原生 provider 要在它那邊也解掉，否則使用者仍能用 Google 登入，
  // 我們的清單卻顯示沒綁 —— 兩邊不一致比沒解綁更糟。
  if (target.provider === 'google' || target.provider === 'email') {
    const { data: authUser } = await db.auth.getUserIdentities()
    const match = authUser?.identities?.find(
      (i) => (i.identity_id ?? i.id) === target.providerUid,
    )
    if (match) {
      const { error } = await db.auth.unlinkIdentity(match)
      if (error) {
        return NextResponse.json(
          { error: { message: `解除失敗：${error.message}`, code: 'provider_refused' } },
          { status: 422 },
        )
      }
    }
  }

  const result = await unlinkIdentity(user.id, identityId)
  if (!result.ok) {
    const message =
      result.reason === 'last_method'
        ? '這是你唯一的登入方式，解除後就進不來了。請先綁定另一種方式。'
        : '找不到這個登入方式'
    return NextResponse.json(
      { error: { message, code: result.reason } },
      { status: result.reason === 'last_method' ? 409 : 404 },
    )
  }

  await audit({
    spaceId: await primarySpaceIdOf(user.id),
    actorId: user.id,
    action: 'identity.unlinked',
    entityType: 'user_identity',
    entityId: identityId,
    before: { provider: target.provider },
    ip: request.headers.get('x-forwarded-for') ?? undefined,
    userAgent: request.headers.get('user-agent') ?? undefined,
  }).catch(() => {})

  return NextResponse.json({ data: { identities: await listIdentities(user.id) } })
}
