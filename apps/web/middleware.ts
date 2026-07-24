import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { GATE_COOKIE, GATE_TOKEN } from '@/lib/gate'

/**
 * 刷新 Supabase session，並套用站台密碼閘門。
 *
 * Server Component 無法寫 cookie，所以 token 刷新必須發生在 middleware。
 * 沒有這一層，使用者會在 access token 過期（1 小時）後被登出，
 * 即使 refresh token 還有效 —— 這正是「登出再登入資料仍在」閉環的隱形殺手。
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── 站台密碼閘門（尚未對外開放）────────────────────────────
  // 沒通過閘門的人只能看到 /gate 與其 API。通過後才進入正常流程。
  const passedGate = request.cookies.get(GATE_COOKIE)?.value === GATE_TOKEN
  // 隱私政策/使用條款公開（不需通過閘門）：OAuth 審核（Google/LINE）要求隱私政策
  // 可公開存取，註冊流程也要能連到這兩頁。（/guide 是站內說明，仍在閘門後。）
  const isPublicInfo = pathname === '/privacy' || pathname === '/terms'
  const isGatePath =
    pathname === '/gate' || pathname.startsWith('/api/gate') || isPublicInfo
  // 外部端點不受站台閘門限制：provider webhook（外部呼叫、無 cookie，04-api-contract §0）
  // 與健康檢查。這些自行驗簽章/授權。
  const isPublicEndpoint =
    pathname.startsWith('/api/webhooks/') || pathname === '/api/health'
  if (isPublicEndpoint) {
    return NextResponse.next({ request })
  }
  if (!passedGate && !isGatePath) {
    const url = request.nextUrl.clone()
    url.pathname = '/gate'
    url.search = pathname !== '/' ? `?next=${encodeURIComponent(pathname)}` : ''
    return NextResponse.redirect(url)
  }
  // 已通過閘門、且正要看 /gate → 直接送進站
  if (passedGate && pathname === '/gate') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return NextResponse.redirect(url)
  }
  // 閘門頁與其 API 不跑 Supabase —— 萬一 auth 服務掛了，
  // 也不能連「輸入密碼」這一頁都 500 把人鎖在外面。
  if (isGatePath) {
    return NextResponse.next({ request })
  }

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
