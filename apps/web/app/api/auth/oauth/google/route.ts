import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * 用 Google 登入（不是綁定 —— 綁定在 /api/auth/link/google）。
 *
 * 這支只負責把人送去 Google。回來之後由 `/auth/callback` 決定放不放行：
 * ADR-003 的邀請閘門在那裡，第三方登入不能繞過。
 *
 * 沒有 space 的人會在 callback 被 signOut，
 * 也就是「用 Google 登入 ≠ 註冊」—— 這一點在登入頁已寫明。
 */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin
  const next = request.nextUrl.searchParams.get('next') ?? '/home'

  const db = await getDb()
  const { data, error } = await db.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  })

  if (error || !data?.url) {
    console.error('[auth/oauth/google] 失敗', error?.message)
    return NextResponse.redirect(new URL('/login?error=google_unavailable', origin))
  }

  return NextResponse.redirect(data.url)
}
