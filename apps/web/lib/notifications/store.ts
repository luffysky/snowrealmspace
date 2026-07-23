import { createAdminClient } from '@snowrealm/db/server'

/**
 * In-app 通知（Milestone E）。docs/spec/03-database.md 的 notifications。
 *
 * 分類、已讀、Quiet hours、一鍵關閉。只做 in_app channel（email/push 不在 E 範圍）。
 * 寫入走 service role（系統代發）；讀取與標記已讀走 RLS（own notifications）。
 */

export type NotificationCategory =
  | 'daily'
  | 'agent'
  | 'weekly_recap'
  | 'milestone'
  | 'processing_done'
  | 'sync_success'
  | 'sync_failed'

export type Notification = {
  id: string
  category: NotificationCategory
  title: string
  body: string | null
  link: string | null
  readAt: string | null
  createdAt: string
}

type Row = {
  id: string
  category: string
  title: string
  body: string | null
  link: string | null
  read_at: string | null
  created_at: string
}

function toNotification(r: Row): Notification {
  return {
    id: r.id,
    category: r.category as NotificationCategory,
    title: r.title,
    body: r.body,
    link: r.link,
    readAt: r.read_at,
    createdAt: r.created_at,
  }
}

export async function createNotification(input: {
  spaceId: string
  userId: string
  category: NotificationCategory
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
  if (error) console.error('[notifications] 寫入失敗', error.message)
}

/** 使用者的通知（最新在前）。走 service role 以 user_id 過濾（RLS 也保證同一件事）。 */
export async function listNotifications(userId: string, limit = 30): Promise<Notification[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('notifications')
    .select('id, category, title, body, link, read_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) console.error('[notifications] 讀取失敗', error.message)
  return (data ?? []).map((r) => toNotification(r as Row))
}

export async function unreadCount(userId: string): Promise<number> {
  const admin = createAdminClient()
  const { count } = await admin
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null)
  return count ?? 0
}

export async function markRead(userId: string, id: string): Promise<void> {
  const admin = createAdminClient()
  await admin
    .from('notifications')
    .update({ read_at: new Date().toISOString() } as never)
    .eq('user_id', userId)
    .eq('id', id)
    .is('read_at', null)
}

export async function markAllRead(userId: string): Promise<void> {
  const admin = createAdminClient()
  await admin
    .from('notifications')
    .update({ read_at: new Date().toISOString() } as never)
    .eq('user_id', userId)
    .is('read_at', null)
}
