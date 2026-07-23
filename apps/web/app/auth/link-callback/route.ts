import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/supabase/server'
import { syncFromAuthIdentities } from '@snowrealm/db/identities'

export const dynamic = 'force-dynamic'

/**
 * Supabase 原生 provider（目前只有 Google）綁定完成後的回呼。
 *
 * 與 `/auth/callback` 分開的理由：那支是**登入**閘門，
 * 沒有 space 就要 signOut。這支是**綁定**，使用者本來就已登入且有 space，
 * 套用登入的邏輯會在極端情況下把人踢出去。
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') ?? '/settings/account'
  const oauthError = url.searchParams.get('error')

  // 使用者在 Google 那邊按了取消 —— 這不是錯誤，安靜回去就好
  if (oauthError === 'access_denied') {
    return NextResponse.redirect(new URL(next, url.origin))
  }

  if (!code) {
    return NextResponse.redirect(new URL(`${next}?error=link_missing_code`, url.origin))
  }

  const db = await getDb()
  const { data, error } = await db.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    // identity_already_exists：這個 Google 帳號已經綁在別人身上。
    // 這是正常且必須明說的情況，不是系統錯誤。
    const already = error?.message?.includes('already') ?? false
    return NextResponse.redirect(
      new URL(`${next}?error=${already ? 'link_taken' : 'link_failed'}`, url.origin),
    )
  }

  // auth.identities 已更新，把投影表同步過來（否則設定頁不會顯示新綁的方式）
  try {
    await syncFromAuthIdentities(data.user.id)
  } catch (err) {
    // 同步失敗不該讓綁定看起來失敗 —— 綁定本身已經成功了。
    // 下次進設定頁會再同步一次。
    console.error('[auth/link-callback] 身分同步失敗', err)
  }

  return NextResponse.redirect(new URL(`${next}?linked=google`, url.origin))
}
