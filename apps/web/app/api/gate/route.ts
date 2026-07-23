import { NextResponse, type NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { GATE_COOKIE, GATE_TOKEN, GATE_MAX_AGE } from '@/lib/gate'

export const dynamic = 'force-dynamic'

/**
 * 站台密碼驗證。
 *
 * 密碼只在這裡（伺服器端）比對，絕不進 client bundle。
 * 預設值寫死一份，讓部署不必額外設定就能運作；
 * 要換密碼設 `SITE_GATE_PASSWORD` 環境變數即可覆寫。
 */
function expectedPassword(): string {
  return process.env['SITE_GATE_PASSWORD'] ?? 'nami0724nami0724'
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

  if (!matches(password, expectedPassword())) {
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
