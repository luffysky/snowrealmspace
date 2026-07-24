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

export type AssetReferenceType =
  | 'background_item'
  | 'theme'
  | 'design_snapshot'
  | 'project_cover'
  | 'timeline'
  | 'agent_avatar'

export type AssetReference = {
  type: AssetReferenceType
  id: string
  label: string
  href: string
  /**
   * cascade 能否自動處理。design_snapshot（作品版本）刻意不可 cascade ——
   * 自動刪掉某件作品的版本太危險，必須使用者到「作品」自己處理。
   */
  cascadable: boolean
}

export async function findReferences(
  db: Db,
  spaceId: string,
  assetId: string,
): Promise<AssetReference[]> {
  const refs: AssetReference[] = []

  const { data: backgrounds } = await db
    .from('background_items')
    .select('id, name')
    .eq('space_id', spaceId)
    .eq('asset_id', assetId)
    .is('deleted_at', null)

  for (const bg of backgrounds ?? []) {
    refs.push({
      type: 'background_item',
      id: bg.id,
      label: bg.name ?? '未命名背景',
      href: `/studio/background`,
      cascadable: true,
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
      cascadable: true,
    })
  }

  // design_snapshots：asset_id 或 document_asset_id 皆算引用。on delete restrict，
  // 且是作品版本 —— 不可 cascade，使用者要到「作品」自己移除。
  const { data: snapshots } = await db
    .from('design_snapshots')
    .select('id, design_file_id, files:design_files(title)')
    .eq('space_id', spaceId)
    .or(`asset_id.eq.${assetId},document_asset_id.eq.${assetId}`)

  for (const snap of snapshots ?? []) {
    const title = (snap as { files?: { title?: string } }).files?.title ?? '某件作品'
    refs.push({
      type: 'design_snapshot',
      id: snap.id,
      label: `作品「${title}」的一個版本`,
      href: `/works`,
      cascadable: false,
    })
  }

  const { data: projectCovers } = await db
    .from('projects')
    .select('id, name')
    .eq('space_id', spaceId)
    .eq('cover_asset_id', assetId)
    .is('deleted_at', null)

  for (const p of projectCovers ?? []) {
    refs.push({
      type: 'project_cover',
      id: p.id,
      label: `專案「${p.name}」的封面`,
      href: `/projects`,
      cascadable: true,
    })
  }

  const { data: timelineCovers } = await db
    .from('timeline_events')
    .select('id, title')
    .eq('space_id', spaceId)
    .eq('cover_asset_id', assetId)
    .is('deleted_at', null)

  for (const t of timelineCovers ?? []) {
    refs.push({
      type: 'timeline',
      id: t.id,
      label: `時間軸「${t.title}」的封面`,
      href: `/timeline`,
      cascadable: true,
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
      cascadable: true,
    })
  }

  return refs
}
