import { NextResponse } from 'next/server'
import { requireActiveSpace, getUser } from '@/lib/auth/session'
import { getDb } from '@/lib/supabase/server'
import { getChainState } from '@snowrealm/daily-engine'

export const dynamic = 'force-dynamic'

/**
 * 生日鏈狀態（哪些已解鎖 + 內容）。
 *
 * 大家共用同一份範本，內容用 {name} 佔位、依開啟者的名字帶入（誰開顯示誰）。
 * 解鎖時序依空間建立（≈註冊）起算：剛好滿 7 天 / 1 年才顯示那一節。
 */
export async function GET() {
  const { space } = await requireActiveSpace()
  const user = await getUser()

  // 開啟者的顯示名（帶入 {name}）
  let name = ''
  if (user) {
    const db = await getDb()
    const { data } = await db.from('profiles').select('display_name').eq('id', user.id).maybeSingle()
    name = (data?.display_name ?? user.username ?? '').trim()
  }

  try {
    return NextResponse.json({ data: { links: await getChainState(space.id, name) } })
  } catch (err) {
    console.error('[api/chain] GET', err)
    return NextResponse.json({ data: { links: [] } })
  }
}
