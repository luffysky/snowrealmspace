import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

/**
 * 把 Google 綁到目前登入的帳號。13-third-party-auth.md §5。
 *
 * 用 Supabase 的 `linkIdentity` 而不是 `signInWithOAuth`：
 * 後者會在 email 相同時**建立或切換到另一個帳號**，
 * 綁定要的是「加到現有帳號」，兩者行為完全不同。
 *
 * 前置條件：Supabase 必須開啟 manual linking
 * （本機 `supabase/config.toml` 的 `enable_manual_linking = true`；
 * hosted 在 Dashboard → Authentication → Providers）。
 * 沒開的話這裡會回 422，訊息會說明原因而不是靜默失敗。
 */
export async function GET(request: NextRequest) {
  await requireUser()

  const db = await getDb()
  const origin = request.nextUrl.origin
  const next = request.nextUrl.searchParams.get('next') ?? '/settings/account'

  const { data, error } = await db.auth.linkIdentity({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/link-callback?next=${encodeURIComponent(next)}`,
      // 綁定不需要離線存取，不要多要權限
      queryParams: { prompt: 'select_account' },
    },
  })

  if (error || !data?.url) {
    const reason = error?.message ?? 'unknown'
    console.error('[auth/link/google] linkIdentity 失敗', reason)
    return NextResponse.redirect(
      new URL(`/settings/account?error=link_failed&provider=google`, origin),
    )
  }

  return NextResponse.redirect(data.url)
}
