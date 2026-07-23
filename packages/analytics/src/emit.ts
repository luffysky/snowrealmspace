import { createAdminClient } from '@snowrealm/db/server'
import {
  isAnalyticsOnly,
  type DomainEvent,
  type DomainEventType,
  type EventProperties,
} from './events.js'

/**
 * 發出領域事件 → 寫入 activity_events。
 *
 * activity_events 對 client 唯讀（RLS 只有 SELECT policy），
 * 所以寫入一律走 service role。
 *
 * fail-soft：事件寫入失敗不應該讓使用者的操作失敗。
 * 但失敗會被記錄，因為靜默丟失事件會讓 Insight 與 Timeline 出現無法解釋的空洞。
 */
export async function emit<T extends DomainEventType>(
  event: DomainEvent<T>,
  options: { activityTracking?: boolean } = {},
): Promise<void> {
  const { activityTracking = true } = options

  if (!activityTracking && isAnalyticsOnly(event.type)) return

  const db = createAdminClient()
  const { error } = await db.from('activity_events').insert({
    space_id: event.spaceId,
    actor_id: event.actorId,
    actor_type: event.actorType,
    event_type: event.type,
    entity_type: event.entityType ?? null,
    entity_id: event.entityId ?? null,
    properties: event.properties as never,
  })

  if (error) {
    console.error('[analytics] 事件寫入失敗', {
      type: event.type,
      spaceId: event.spaceId,
      error: error.message,
    })
  }
}

/** 型別安全的簡寫，讓呼叫端不必手動組 DomainEvent 物件。 */
export async function emitEvent<T extends DomainEventType>(
  type: T,
  spaceId: string,
  actorId: string | null,
  properties: EventProperties[T],
  extra: {
    actorType?: 'user' | 'agent' | 'system'
    entityType?: string
    entityId?: string
    activityTracking?: boolean
  } = {},
): Promise<void> {
  const { activityTracking, actorType = 'user', ...rest } = extra
  await emit<T>(
    { type, spaceId, actorId, actorType, properties, ...rest },
    activityTracking === undefined ? {} : { activityTracking },
  )
}
