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

  // ── 後台隨機碼（防掃描，配合 checkSiteAdmin 的角色閘門雙層）──────────
  // 設了 env ADMIN_SEGMENT 才啟用：後台只在 /<碼>/admin 存取，裸 /admin 回 404。
  // ADMIN_SEGMENT 是伺服器端 env（不加 NEXT_PUBLIC），不會外洩到瀏覽器。
  const adminSeg = process.env.ADMIN_SEGMENT?.trim()
  if (adminSeg) {
    const secret = `/${adminSeg}/admin`
    if (pathname === secret || pathname.startsWith(secret + '/')) {
      // 密路徑 → 內部改寫到 /admin（瀏覽器網址仍是密路徑）。後台頁自己有角色閘門。
      const url = request.nextUrl.clone()
      url.pathname = pathname.slice(`/${adminSeg}`.length)
      return NextResponse.rewrite(url)
    }
    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
      // 裸 /admin → 當作不存在
      return new NextResponse(null, { status: 404 })
    }
  }

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
  // 排除靜態資產。特別是 manifest.webmanifest、robots、sitemap：PWA/爬蟲抓這些時
  // 通常不帶 cookie，若被閘門攔就會拿到 /gate 的 HTML → 瀏覽器解析 manifest 失敗。
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
}
