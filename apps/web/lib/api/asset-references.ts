import type { Db } from '@snowrealm/db/server'

/**
 * 找出誰在引用某個 asset。
 *
 * 02-domain-model.md §5.4：刪除 asset 前必須檢查引用。
 * DB 層的 `on delete restrict`（design_snapshots）是最後防線，
 * 但使用者需要的是「刪了會影響什麼」的清單，而不是一句外鍵錯誤。
 *
 * 新增引用 asset 的表時，**必須同時更新這裡** ——
 * 漏掉會讓刪除流程默默留下壞掉的引用。
 */

export type AssetReference = {
  type: 'background_item' | 'theme' | 'design_snapshot' | 'agent_avatar'
  id: string
  label: string
  href: string
}

export async function findReferences(
  db: Db,
  spaceId: string,
  assetId: string,
): Promise<AssetReference[]> {
  const refs: AssetReference[] = []

  const { data: backgrounds } = await db
    .from('background_items')
    .select('id, name, type')
    .eq('space_id', spaceId)
    .eq('asset_id', assetId)
    .is('deleted_at', null)

  for (const bg of backgrounds ?? []) {
    refs.push({
      type: 'background_item',
      id: bg.id,
      label: bg.name ?? '未命名背景',
      href: `/studio/background`,
    })
  }

  const { data: themes } = await db
    .from('themes')
    .select('id, name')
    .eq('space_id', spaceId)
    .eq('source_asset_id', assetId)
    .is('deleted_at', null)

  for (const theme of themes ?? []) {
    refs.push({
      type: 'theme',
      id: theme.id,
      label: `主題「${theme.name}」`,
      href: `/studio/theme?id=${theme.id}`,
    })
  }

  const { data: agentProfile } = await db
    .from('agent_profiles')
    .select('space_id, display_name')
    .eq('space_id', spaceId)
    .eq('avatar_asset_id', assetId)
    .maybeSingle()

  if (agentProfile) {
    refs.push({
      type: 'agent_avatar',
      id: agentProfile.space_id,
      label: `${agentProfile.display_name} 的頭像`,
      href: '/settings',
    })
  }

  // design_snapshots 在 Milestone C 才建立。屆時在此加入查詢 ——
  // 它是 on delete restrict，漏檢查會變成無法解釋的外鍵錯誤。

  return refs
}
