import { NextResponse, type NextRequest } from 'next/server'
import { getUser } from '@/lib/auth/session'
import { startLineAuth, lineConfig } from '@snowrealm/db/line-oauth'

export const dynamic = 'force-dynamic'

/**
 * 導向 LINE 授權頁。13-third-party-auth.md §2.1 路線 B。
 *
 * 兩種用途共用同一支：
 *   intent=link  綁定到目前登入的帳號（必須已登入）
 *   intent=login 用已綁定的 LINE 身分登入（必須未登入或無所謂）
 *
 * §6：LINE **不支援註冊**。沒綁過的 LINE 帳號用 intent=login
 * 會在 callback 被擋下並說明原因，而不是靜靜建立一個進不去的帳號。
 */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin

  const intent = request.nextUrl.searchParams.get('intent') === 'login' ? 'login' : 'link'
  const next = request.nextUrl.searchParams.get('next') ?? undefined

  const user = await getUser()

  // 已登入者不能導去 /login —— middleware 會立刻把他丟回 /home，
  // query string 裡的錯誤訊息就消失了，看起來像是「按了沒反應」。
  const errorBase = user ? '/settings/account' : '/login'

  if (!lineConfig()) {
    return NextResponse.redirect(new URL(`${errorBase}?error=line_not_configured`, origin))
  }

  if (intent === 'link' && !user) {
    return NextResponse.redirect(new URL('/login', origin))
  }

  try {
    const { authorizeUrl } = await startLineAuth({
      intent,
      userId: intent === 'link' ? user?.id : undefined,
      redirectTo: next,
    })
    return NextResponse.redirect(authorizeUrl)
  } catch (err) {
    console.error('[auth/line/start] 失敗', err)
    return NextResponse.redirect(new URL(`${errorBase}?error=line_start_failed`, origin))
  }
}
