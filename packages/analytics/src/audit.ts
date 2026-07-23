import { createHash } from 'node:crypto'
import { createAdminClient } from '@snowrealm/db/server'

/**
 * 可選欄位一律接受 undefined。
 * exactOptionalPropertyTypes 下，`ip?: string` 會拒絕明確傳入的 undefined，
 * 而 `request.headers.get()` 的回傳正是 `string | null`，
 * 逼得每個呼叫端都要寫條件展開。這裡放寬型別，讓呼叫端保持乾淨。
 */
export type AuditEntry = {
  spaceId: string | null
  actorId: string | null
  actorType?: 'user' | 'agent' | 'system' | undefined
  action: string
  entityType?: string | undefined
  entityId?: string | undefined
  before?: unknown
  after?: unknown
  ip?: string | undefined
  userAgent?: string | undefined
}

/**
 * IP 以雜湊儲存，不存明文。
 * 加鹽讓相同 IP 在不同部署間無法被交叉比對。
 */
function hashIp(ip: string | undefined, salt: string): string | null {
  if (!ip) return null
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32)
}

/**
 * 稽核紀錄。與 activity_events 的差別：
 *   activity_events —— 產品行為，會餵給 Timeline / Insight
 *   audit_logs      —— 安全稽核，記錄「誰改了什麼」的前後值
 */
export async function audit(entry: AuditEntry, ipSalt = 'snowrealm'): Promise<void> {
  const db = createAdminClient()
  const { error } = await db.from('audit_logs').insert({
    space_id: entry.spaceId,
    actor_id: entry.actorId,
    actor_type: entry.actorType ?? 'user',
    action: entry.action,
    entity_type: entry.entityType ?? null,
    entity_id: entry.entityId ?? null,
    before: (entry.before ?? null) as never,
    after: (entry.after ?? null) as never,
    ip_hash: hashIp(entry.ip, ipSalt),
    user_agent: entry.userAgent?.slice(0, 300) ?? null,
  })

  if (error) {
    console.error('[audit] 寫入失敗', { action: entry.action, error: error.message })
  }
}
