/**
 * Timeline 投影規則（ADR-013：activity_events 是事實來源，timeline_events 是投影）。
 * 見 docs/spec/08-jobs-events.md §1.3。
 *
 * 這裡是**純函式**：給一筆 activity_event 就回傳它該長成的 timeline 樣子（或 null 表示不投影）。
 * 節流（同型別事件在時間窗內合併）與 DB 寫入由 worker 的 event.project handler 負責。
 */

export type ActivityEventRow = {
  id: string
  space_id: string
  event_type: string
  entity_type: string | null
  entity_id: string | null
  properties: Record<string, unknown>
  occurred_at: string
}

export type Visibility = 'private' | 'shareable' | 'hidden'

export type ProjectedTimeline = {
  source_event_id: string
  space_id: string
  event_type: string
  title: string
  body: string | null
  entity_type: string | null
  entity_id: string | null
  cover_asset_id: string | null
  project_id: string | null
  visibility: Visibility
  occurred_at: string
}

type Rule = {
  title: (p: Record<string, unknown>) => string
  visibility?: Visibility
  /** 從事件取封面 asset id（預設用 entity_id）。 */
  cover?: (row: ActivityEventRow) => string | null
  /** 從 properties 取關聯專案 id。 */
  projectId?: (p: Record<string, unknown>) => string | null
  /** 節流窗（分鐘）；同型別在窗內合併成一筆。 */
  throttleMinutes?: number
  groupTitle?: (n: number) => string
  /** 只在符合條件時才投影（例如 surprise 只投影 rare 以上）。 */
  when?: (p: Record<string, unknown>) => boolean
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary']

export const PROJECTED: Record<string, Rule> = {
  'project.created': {
    title: (p) => `開始了「${str(p.name)}」`,
    projectId: (p) => (typeof p.projectId === 'string' ? p.projectId : null),
  },
  'project.completed': {
    title: (p) => `完成了「${str(p.name)}」`,
    projectId: (p) => (typeof p.projectId === 'string' ? p.projectId : null),
  },
  // 封面讀 properties.assetId（emit 把 asset id 放這裡，entity_id 是 null）——
  // 原本讀 entity_id 導致每張「新增了作品」卡片封面都是 null。
  'asset.uploaded': {
    title: () => '新增了作品',
    cover: (row) => (typeof row.properties.assetId === 'string' ? row.properties.assetId : null),
    throttleMinutes: 60,
    groupTitle: (n) => `新增了 ${n} 個作品`,
  },
  'design.linked': {
    title: () => '把一個檔案設為作品',
    cover: (row) => (typeof row.properties.assetId === 'string' ? row.properties.assetId : null),
  },
  'design.synced': {
    title: () => '同步了新版本',
  },
  'theme.created': {
    title: (p) => `建立了主題「${str(p.name)}」`,
  },
  'theme.applied': {
    title: () => '套用了新主題',
    throttleMinutes: 1440,
  },
  'surprise.unlocked': {
    title: () => '解鎖了一個稀有驚喜',
    when: (p) => {
      const r = str(p.rarity)
      return RARITY_ORDER.indexOf(r) >= RARITY_ORDER.indexOf('rare')
    },
  },
  'memory.approved': {
    title: () => '新增了一則記憶',
    visibility: 'private',
  },
}

export function isProjectable(eventType: string): boolean {
  return eventType in PROJECTED
}

export function throttleMinutesFor(eventType: string): number | null {
  return PROJECTED[eventType]?.throttleMinutes ?? null
}

export function groupTitleFor(eventType: string, n: number): string | null {
  const rule = PROJECTED[eventType]
  if (!rule) return null
  if (rule.groupTitle && n > 1) return rule.groupTitle(n)
  return rule.title(({} as Record<string, unknown>))
}

/**
 * 把一筆 activity_event 投影成 timeline 列。不投影的事件（規則沒列、或 when 不通過）回 null。
 */
export function projectRow(row: ActivityEventRow): ProjectedTimeline | null {
  const rule = PROJECTED[row.event_type]
  if (!rule) return null
  if (rule.when && !rule.when(row.properties)) return null

  return {
    source_event_id: row.id,
    space_id: row.space_id,
    event_type: row.event_type,
    title: rule.title(row.properties),
    body: null,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    cover_asset_id: rule.cover ? rule.cover(row) : null,
    project_id: rule.projectId ? rule.projectId(row.properties) : null,
    visibility: rule.visibility ?? 'private',
    occurred_at: row.occurred_at,
  }
}
