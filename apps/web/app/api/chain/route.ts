import { NextResponse } from 'next/server'
import { requireActiveSpace } from '@/lib/auth/session'
import { getChainState } from '@snowrealm/daily-engine'

export const dynamic = 'force-dynamic'

/** 生日鏈狀態（哪些已解鎖 + 內容）。 */
export async function GET() {
  const { space } = await requireActiveSpace()
  try {
    return NextResponse.json({ data: { links: await getChainState(space.id) } })
  } catch (err) {
    console.error('[api/chain] GET', err)
    return NextResponse.json({ data: { links: [] } })
  }
}
