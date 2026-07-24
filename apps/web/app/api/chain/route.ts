import { NextResponse } from 'next/server'
import { requireActiveSpace } from '@/lib/auth/session'
import { getChainState } from '@snowrealm/daily-engine'

export const dynamic = 'force-dynamic'

/** 生日鏈狀態（哪些已解鎖 + 內容）。只有生日主角看得到。 */
export async function GET() {
  const { space, settings } = await requireActiveSpace()
  // 非生日主角不回傳生日信內容（防外洩）
  if (!settings.is_birthday_recipient) {
    return NextResponse.json({ data: { links: [] } })
  }
  try {
    return NextResponse.json({ data: { links: await getChainState(space.id) } })
  } catch (err) {
    console.error('[api/chain] GET', err)
    return NextResponse.json({ data: { links: [] } })
  }
}
