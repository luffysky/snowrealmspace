/**
 * 領域事件型別。見 docs/spec/08-jobs-events.md §1。
 *
 * ADR-013：activity_events 是唯一 append-only 事實來源。
 * DomainEvent 是傳輸格式，不是資料表。
 */

export type DomainEventType =
  | 'space.opened'
  | 'space.created'
  | 'theme.created'
  | 'theme.updated'
  | 'theme.applied'
  | 'theme.deleted'
  | 'background.added'
  | 'background.changed'
  | 'playlist.started'
  | 'asset.uploaded'
  | 'asset.deleted'
  | 'design.linked'
  | 'design.synced'
  | 'design.analyzed'
  | 'design.compared'
  | 'project.created'
  | 'project.completed'
  | 'project.status_changed'
  | 'agent.message.sent'
  | 'agent.action.completed'
  | 'agent.action.undone'
  | 'memory.proposed'
  | 'memory.approved'
  | 'memory.rejected'
  | 'memory.deleted'
  | 'daily.item.opened'
  | 'surprise.unlocked'
  | 'insight.created'
  | 'milestone.reached'
  | 'widget.added'
  | 'widget.error'
  | 'layout.saved'
  | 'integration.connected'
  | 'integration.disconnected'
  | 'integration.error'
  | 'settings.changed'

/**
 * 每個事件型別的 properties 都有具體型別，不是 Record<string, unknown>。
 * 新增事件時必須同時在此宣告 —— 忘了會是編譯錯誤。
 */
export type EventProperties = {
  'space.opened': { route: string }
  'space.created': { spaceName: string; viaInvite: boolean }
  'theme.created': { themeId: string; name: string; source: string }
  'theme.updated': { themeId: string }
  'theme.applied': {
    themeId: string
    previousThemeId: string | null
    source: 'user' | 'agent' | 'schedule'
  }
  'theme.deleted': { themeId: string }
  'background.added': { backgroundItemId: string; assetId: string | null; type: string }
  'background.changed': { backgroundItemId: string; reason: 'manual' | 'schedule' | 'playlist' }
  'playlist.started': { playlistId: string; itemCount: number }
  'asset.uploaded': { assetId: string; kind: string; bytes: number; deduplicated: boolean }
  'asset.deleted': { assetId: string; cascade: boolean }
  'design.linked': { designFileId: string; assetId: string; provider: string }
  'design.synced': { designFileId: string; snapshotId: string; provider: string }
  'design.analyzed': { snapshotId: string; depth: 'light' | 'deep'; model: string; isFree: boolean }
  'design.compared': { snapshotIdA: string; snapshotIdB: string }
  'project.created': { projectId: string; name: string }
  'project.completed': { projectId: string; name: string }
  'project.status_changed': { projectId: string; from: string; to: string }
  'agent.message.sent': { threadId: string; messageId: string; isFree: boolean; escalated: boolean }
  'agent.action.completed': { actionId: string; tool: string }
  'agent.action.undone': { actionId: string; tool: string }
  'memory.proposed': { memoryId: string; type: string }
  'memory.approved': { memoryId: string; type: string; sourceType: string }
  'memory.rejected': { memoryId: string }
  'memory.deleted': { memoryId: string; bulk: boolean }
  'daily.item.opened': { dailyItemId: string; kind: string }
  'surprise.unlocked': { surpriseId: string; rarity: string; chainKey: string | null }
  'insight.created': { insightId: string; type: string; confidence: number }
  'milestone.reached': { key: string; label: string }
  'widget.added': { definitionId: string; layoutId: string }
  /** 不含任何使用者內容 —— 只有識別資訊（08-jobs-events.md §1.1）。 */
  'widget.error': { definitionId: string; version: string; errorName: string }
  'layout.saved': { layoutId: string; breakpoint: string; widgetCount: number }
  'integration.connected': { provider: string; connectionId: string }
  'integration.disconnected': { provider: string; connectionId: string; purgedData: boolean }
  'integration.error': { provider: string; connectionId: string; errorKind: string }
  'settings.changed': { keys: string[] }
}

export type ActorType = 'user' | 'agent' | 'system'

export type DomainEvent<T extends DomainEventType = DomainEventType> = {
  type: T
  spaceId: string
  actorId: string | null
  actorType: ActorType
  entityType?: string
  entityId?: string
  properties: EventProperties[T]
}

/**
 * 純分析用的事件。activity_tracking 關閉時不寫入這些。
 * 其他事件（會影響產品行為的）即使關閉追蹤也照寫。
 * 見 docs/spec/08-jobs-events.md §1.2。
 */
export const ANALYTICS_ONLY_EVENTS: ReadonlySet<DomainEventType> = new Set([
  'space.opened',
  'widget.error',
  'widget.added',
  'layout.saved',
  'background.changed',
])

export function isAnalyticsOnly(type: DomainEventType): boolean {
  return ANALYTICS_ONLY_EVENTS.has(type)
}
