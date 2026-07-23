import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * 刷新 Supabase session。
 *
 * Server Component 無法寫 cookie，所以 token 刷新必須發生在 middleware。
 * 沒有這一層，使用者會在 access token 過期（1 小時）後被登出，
 * 即使 refresh token 還有效 —— 這正是「登出再登入資料仍在」閉環的隱形殺手。
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => request.cookies.get(name)?.value,
        set: (name, value, options) => {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request })
          response.cookies.set({ name, value, ...options })
        },
        remove: (name, options) => {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    },
  )

  // 這行是重點：它會在需要時用 refresh token 換新的 access token 並寫回 cookie。
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isProtected =
    pathname.startsWith('/home') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/studio') ||
    pathname.startsWith('/design') ||
    pathname.startsWith('/library') ||
    pathname.startsWith('/timeline') ||
    pathname.startsWith('/agent')

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  if (pathname === '/login' && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/home'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
