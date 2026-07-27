import { createAdminClient } from '@snowrealm/db/server'

/**
 * 建立 in-app 通知（沿用既有 notifications 表與 sync_success/sync_failed 分類；Milestone E）。
 * 系統代發 → service role 寫入（與 apps/web 的 createNotification 同機制）。失敗只 log，不拋。
 */
export type SyncNotifyCategory = 'sync_success' | 'sync_failed'

export async function notifySyncOutcome(input: {
  spaceId: string
  userId: string
  category: SyncNotifyCategory
  title: string
  body?: string
  link?: string
}): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin.from('notifications').insert({
    space_id: input.spaceId,
    user_id: input.userId,
    category: input.category,
    title: input.title,
    body: input.body ?? null,
    link: input.link ?? null,
    channel: 'in_app',
  } as never)
  if (error) console.error('[design-sync] 通知寫入失敗', error.message)
}
