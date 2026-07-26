import type { Db } from '@snowrealm/db/server'
import { storage } from '@snowrealm/storage'

/**
 * 把 avatar_asset_id 解成短期 signed URL（private bucket）。
 *
 * 傳入哪個 client 決定授權範圍：
 *  - 同 space / 本人：傳受 RLS 的 getDb()（只讀得到自己 space 的 asset）。
 *  - 跨 space 的管理頁：傳 createAdminClient()（繞 RLS），呼叫端須先 checkSiteAdmin()。
 *
 * R2 未設定或解析失敗回 null（大頭貼是裝飾，不擋頁面）——呼叫端退回名字首字。
 */
export async function resolveAvatarUrl(
  db: Db,
  assetId: string | null | undefined,
): Promise<string | null> {
  if (!assetId) return null
  const { data } = await db
    .from('assets')
    .select('storage_key')
    .eq('id', assetId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!data) return null
  try {
    return await storage().createDownloadUrl({ key: data.storage_key })
  } catch {
    return null
  }
}

/**
 * 批次版：管理頁一次列很多人時用，一個查詢 + 逐一簽名（R2 簽名是本地運算，便宜）。
 * 回傳 assetId → signed URL 的 map。
 */
export async function resolveAvatarUrls(
  db: Db,
  assetIds: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const ids = [...new Set(assetIds.filter((x): x is string => Boolean(x)))]
  if (ids.length === 0) return out
  const { data } = await db
    .from('assets')
    .select('id, storage_key')
    .in('id', ids)
    .is('deleted_at', null)
  const store = storage()
  for (const row of data ?? []) {
    try {
      out.set(row.id, await store.createDownloadUrl({ key: row.storage_key }))
    } catch {
      /* 略過這一個，退回名字首字 */
    }
  }
  return out
}
