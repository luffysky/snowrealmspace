import { createAdminClient } from '@snowrealm/db/server'

/**
 * 生日鏈。09-content-pool.md §7。
 *
 * 一串**依條件逐步解鎖**的內容（不是依日期）。已解鎖的顯示內容，
 * 未解鎖的只顯示「還沒解鎖」與條件提示 —— 給使用者一個往前走的理由。
 */

export type ChainAvailability =
  | 'immediately'
  | 'after_first_theme'
  | 'after_first_upload'
  | 'after_7_days'
  | 'after_1_year'

export type ChainLinkView = {
  index: number
  title: string
  /** 未解鎖時為 null（不洩漏內容） */
  text: string | null
  unlocked: boolean
  /** 未解鎖時的條件說明 */
  hint: string | null
}

const HINT: Record<ChainAvailability, string> = {
  immediately: '',
  after_first_theme: '換一次主題後解鎖',
  after_first_upload: '上傳第一個作品後解鎖',
  after_7_days: '用滿七天後解鎖',
  after_1_year: '一年後解鎖',
}

export async function getChainState(spaceId: string): Promise<ChainLinkView[]> {
  const admin = createAdminClient()

  const { data: links } = await admin
    .from('content_items')
    .select('content_id, label, text, chain_index, available_from')
    .eq('kind', 'chain')
    .eq('enabled', true)
    .order('chain_index', { ascending: true })

  if (!links || links.length === 0) return []

  // 解鎖條件所需的事實
  const [themeCount, assetCount, space] = await Promise.all([
    admin.from('themes').select('*', { count: 'exact', head: true }).eq('space_id', spaceId).is('deleted_at', null),
    admin.from('assets').select('*', { count: 'exact', head: true }).eq('space_id', spaceId).is('deleted_at', null),
    admin.from('spaces').select('created_at').eq('id', spaceId).maybeSingle(),
  ])

  const hasTheme = (themeCount.count ?? 0) > 0
  const hasUpload = (assetCount.count ?? 0) > 0
  const daysSince = space.data?.created_at
    ? Math.floor((Date.now() - Date.parse(space.data.created_at)) / 86400000)
    : 0

  const isUnlocked = (cond: ChainAvailability): boolean => {
    switch (cond) {
      case 'immediately':
        return true
      case 'after_first_theme':
        return hasTheme
      case 'after_first_upload':
        return hasUpload
      case 'after_7_days':
        return daysSince >= 7
      case 'after_1_year':
        return daysSince >= 365
    }
  }

  return links.map((link) => {
    const cond = (link.available_from as ChainAvailability) ?? 'immediately'
    const unlocked = isUnlocked(cond)
    return {
      index: link.chain_index ?? 0,
      title: link.label ?? '',
      text: unlocked ? link.text : null,
      unlocked,
      hint: unlocked ? null : HINT[cond] || '尚未解鎖',
    }
  })
}
