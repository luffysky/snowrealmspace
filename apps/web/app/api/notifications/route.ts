import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/auth/session'
import { listNotifications, unreadCount, markRead, markAllRead } from '@/lib/notifications/store'

export const dynamic = 'force-dynamic'

/** 使用者的通知 + 未讀數。 */
export async function GET() {
  const user = await requireUser()
  try {
    const [items, unread] = await Promise.all([listNotifications(user.id), unreadCount(user.id)])
    return NextResponse.json({ data: { items, unread } })
  } catch (err) {
    console.error('[api/notifications] GET', err)
    return NextResponse.json({ data: { items: [], unread: 0 } })
  }
}

const bodySchema = z.union([
  z.object({ action: z.literal('read'), id: z.string().uuid() }),
  z.object({ action: z.literal('read_all') }),
])

/** 標記已讀（單筆或全部）。 */
export async function POST(req: Request) {
  const user = await requireUser()
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: { message: '參數錯誤' } }, { status: 400 })
  }
  try {
    if (parsed.data.action === 'read') await markRead(user.id, parsed.data.id)
    else await markAllRead(user.id)
    return NextResponse.json({ data: { ok: true } })
  } catch (err) {
    console.error('[api/notifications] POST', err)
    return NextResponse.json({ error: { message: '操作失敗' } }, { status: 500 })
  }
}
