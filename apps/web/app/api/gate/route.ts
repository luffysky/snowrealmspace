import { NextResponse, type NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { GATE_COOKIE, GATE_TOKEN, GATE_MAX_AGE } from '@/lib/gate'

export const dynamic = 'force-dynamic'

/**
 * 站台密碼驗證。
 *
 * 密碼只在這裡（伺服器端）比對，絕不進 client bundle。
 * **不再寫死預設密碼**：閘門預設關閉（middleware 看 NEXT_PUBLIC_SITE_GATE_ENABLED）。
 * 要啟用封閉測試，同時設 `NEXT_PUBLIC_SITE_GATE_ENABLED=true` 與 `SITE_GATE_PASSWORD=<自訂>`。
 * 沒設 SITE_GATE_PASSWORD 時一律拒絕（不會有可猜的預設值）。
 */
function expectedPassword(): string | null {
  const p = process.env['SITE_GATE_PASSWORD']?.trim()
  return p && p.length > 0 ? p : null
}

/** 定長比較，避免以回應時間推敲密碼。 */
function matches(input: string, expected: string): boolean {
  const a = Buffer.from(input)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { password?: string } | null
  const password = body?.password ?? ''

  const expected = expectedPassword()
  // 沒設密碼＝閘門形同關閉，一律拒絕（不放行、也沒有可猜的預設）。
  if (!expected || !matches(password, expected)) {
    // 不透露是「太短」還是「不對」—— 一律同一個訊息
    return NextResponse.json({ error: { message: '密碼不對。' } }, { status: 401 })
  }

  const res = NextResponse.json({ data: { ok: true } })
  res.cookies.set({
    name: GATE_COOKIE,
    value: GATE_TOKEN,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: GATE_MAX_AGE,
  })
  return res
}
