import { z } from 'zod'
import type { GridItem } from './grid.js'

/**
 * Widget 註冊表。見 docs/spec/06-widget-contract.md §3–§4。
 *
 * v1.0 §14.4 的 configSchema 是 Record<string, unknown>，等於沒定義。
 * 這裡用 zod：型別能推導到元件 props，設定面板可自動產生，前後端共用驗證。
 */

export const WIDGET_IDS = [
  // Birthday Alpha（v1.0 §14.2）
  'daily_card',
  'surprise_box',
  'agent_message',
  'current_project',
  'recent_designs',
  'quick_note',
  'theme_switcher',
  'background_control',
  'timeline_preview',
  // Future（v1.0 §14.3）
  'calendar',
  'focus_timer',
  'music',
  'weather',
  'mood_checkin',
  'inspiration_board',
  'goal_tracker',
  'figma_changes',
  'canva_export',
  'creative_streak',
  'shared_messages',
] as const

export type WidgetId = (typeof WIDGET_IDS)[number]

/**
 * 從 string[] 改為列舉的意義：
 * network:external 與 location 讓「使用者控制是否連接外部服務」
 * （v1.0 §5.1）能在 widget 層級落實，而不只是全域開關。
 */
export type WidgetPermission =
  | 'read:daily'
  | 'read:designs'
  | 'read:projects'
  | 'read:themes'
  | 'read:timeline'
  | 'read:agent'
  | 'read:memories'
  | 'write:notes'
  | 'write:themes'
  | 'write:backgrounds'
  | 'network:external'
  | 'location'

export type WidgetDefinition<TConfig = unknown> = {
  id: WidgetId
  name: string
  version: string
  category: 'daily' | 'creative' | 'agent' | 'project' | 'system' | 'utility'
  description: string
  defaultSize: { w: number; h: number }
  minSize: { w: number; h: number }
  maxSize: { w: number; h: number }
  configSchema: z.ZodType<TConfig>
  defaultConfig: TConfig
  permissions: WidgetPermission[]
  featureFlag?: string
  refreshPolicy: {
    onMount: boolean
    intervalSeconds?: number
    onEvents?: string[]
  }
}

// ── Birthday Alpha 的九個 widget（06-widget-contract.md §4）────────

const dailyCardConfig = z.object({
  showArchiveLink: z.boolean().default(true),
  compact: z.boolean().default(false),
})

const surpriseBoxConfig = z.object({
  autoOpenOnLogin: z.boolean().default(false),
  showRarityLabel: z.boolean().default(true),
})

const agentMessageConfig = z.object({
  showAvatar: z.boolean().default(true),
  maxMessages: z.number().int().min(1).max(5).default(1),
  allowQuickReply: z.boolean().default(true),
})

const currentProjectConfig = z.object({
  projectId: z.string().uuid().nullable().default(null),
  showProgress: z.boolean().default(true),
  showRecentAssets: z.boolean().default(true),
})

const recentDesignsConfig = z.object({
  limit: z.number().int().min(2).max(12).default(6),
  projectId: z.string().uuid().nullable().default(null),
  layout: z.enum(['grid', 'carousel']).default('grid'),
})

const quickNoteConfig = z.object({
  placeholder: z.string().max(80).default('隨手記下…'),
  autoSaveSeconds: z.number().int().min(2).max(30).default(5),
  targetProjectId: z.string().uuid().nullable().default(null),
})

const themeSwitcherConfig = z.object({
  showFavoritesOnly: z.boolean().default(false),
  limit: z.number().int().min(3).max(12).default(6),
})

const backgroundControlConfig = z.object({
  showPlaylistName: z.boolean().default(true),
  allowSkip: z.boolean().default(true),
  // ADR-019：影片必須可暫停（WCAG Pause, Stop, Hide）
  allowPause: z.boolean().default(true),
})

const timelinePreviewConfig = z.object({
  limit: z.number().int().min(3).max(10).default(5),
  view: z.enum(['recent', 'on_this_day']).default('recent'),
})

function def<T>(d: WidgetDefinition<T>): WidgetDefinition<T> {
  return d
}

export const WIDGET_REGISTRY = {
  daily_card: def({
    id: 'daily_card',
    name: '每日卡片',
    version: '1.0.0',
    category: 'daily',
    description: '今天的內容。',
    defaultSize: { w: 4, h: 3 },
    minSize: { w: 3, h: 2 },
    maxSize: { w: 6, h: 5 },
    configSchema: dailyCardConfig,
    defaultConfig: dailyCardConfig.parse({}),
    permissions: ['read:daily'],
    refreshPolicy: { onMount: true, onEvents: ['daily.item.opened'] },
  }),

  surprise_box: def({
    id: 'surprise_box',
    name: '驚喜盒',
    version: '1.0.0',
    category: 'daily',
    description: '可以打開的東西。',
    defaultSize: { w: 3, h: 3 },
    minSize: { w: 2, h: 2 },
    maxSize: { w: 4, h: 4 },
    configSchema: surpriseBoxConfig,
    defaultConfig: surpriseBoxConfig.parse({}),
    permissions: ['read:daily'],
    refreshPolicy: { onMount: true, onEvents: ['surprise.unlocked'] },
  }),

  agent_message: def({
    id: 'agent_message',
    name: 'Agent 訊息',
    version: '1.0.0',
    category: 'agent',
    description: 'Agent 想說的話。',
    defaultSize: { w: 4, h: 2 },
    minSize: { w: 3, h: 2 },
    maxSize: { w: 8, h: 4 },
    configSchema: agentMessageConfig,
    defaultConfig: agentMessageConfig.parse({}),
    permissions: ['read:agent'],
    refreshPolicy: { onMount: true, onEvents: ['agent.message.sent'] },
  }),

  current_project: def({
    id: 'current_project',
    name: '目前專案',
    version: '1.0.0',
    category: 'project',
    description: '你最近在做的事。',
    defaultSize: { w: 4, h: 3 },
    minSize: { w: 3, h: 2 },
    maxSize: { w: 8, h: 5 },
    configSchema: currentProjectConfig,
    defaultConfig: currentProjectConfig.parse({}),
    permissions: ['read:projects'],
    refreshPolicy: { onMount: true, onEvents: ['project.status_changed'] },
  }),

  recent_designs: def({
    id: 'recent_designs',
    name: '最近作品',
    version: '1.0.0',
    category: 'creative',
    description: '你最近放進來的東西。',
    defaultSize: { w: 6, h: 3 },
    minSize: { w: 3, h: 2 },
    maxSize: { w: 12, h: 6 },
    configSchema: recentDesignsConfig,
    defaultConfig: recentDesignsConfig.parse({}),
    permissions: ['read:designs'],
    refreshPolicy: { onMount: true, onEvents: ['asset.uploaded', 'design.linked'] },
  }),

  quick_note: def({
    id: 'quick_note',
    name: '隨手記',
    version: '1.0.0',
    category: 'utility',
    description: '想到什麼就寫下來。',
    defaultSize: { w: 4, h: 3 },
    minSize: { w: 3, h: 2 },
    maxSize: { w: 6, h: 6 },
    configSchema: quickNoteConfig,
    defaultConfig: quickNoteConfig.parse({}),
    permissions: ['write:notes'],
    refreshPolicy: { onMount: false },
  }),

  theme_switcher: def({
    id: 'theme_switcher',
    name: '主題切換',
    version: '1.0.0',
    category: 'system',
    description: '換一套外觀。',
    defaultSize: { w: 4, h: 2 },
    minSize: { w: 3, h: 2 },
    maxSize: { w: 8, h: 4 },
    configSchema: themeSwitcherConfig,
    defaultConfig: themeSwitcherConfig.parse({}),
    permissions: ['read:themes', 'write:themes'],
    refreshPolicy: { onMount: true, onEvents: ['theme.created', 'theme.applied'] },
  }),

  background_control: def({
    id: 'background_control',
    name: '背景控制',
    version: '1.0.0',
    category: 'system',
    description: '切換或暫停背景。',
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 2, h: 1 },
    maxSize: { w: 6, h: 3 },
    configSchema: backgroundControlConfig,
    defaultConfig: backgroundControlConfig.parse({}),
    permissions: ['write:backgrounds'],
    refreshPolicy: { onMount: true, onEvents: ['background.changed'] },
  }),

  timeline_preview: def({
    id: 'timeline_preview',
    name: '時間軸',
    version: '1.0.0',
    category: 'system',
    description: '最近發生的事。',
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
    maxSize: { w: 6, h: 8 },
    configSchema: timelinePreviewConfig,
    defaultConfig: timelinePreviewConfig.parse({}),
    permissions: ['read:timeline'],
    refreshPolicy: { onMount: true, intervalSeconds: 300 },
  }),
}

export type RegisteredWidgetId = keyof typeof WIDGET_REGISTRY

/**
 * 編譯期檢查：註冊表的每個 key 都必須是合法的 WidgetId。
 *
 * 不用 `satisfies Record<WidgetId, WidgetDefinition<...>>` 的原因：
 * zod 的 ZodType 對其型別參數是不變的（invariant），
 * 在 exactOptionalPropertyTypes 下任何統一的上界都無法容納各自的 config 型別。
 * 這個斷言只驗 key，讓每個 entry 保有自己精確的 config 型別。
 */
type AssertKeysAreWidgetIds = RegisteredWidgetId extends WidgetId ? true : never
const _keysAreValid: AssertKeysAreWidgetIds = true
void _keysAreValid

export function getWidgetDefinition(id: string): WidgetDefinition<unknown> | null {
  return (WIDGET_REGISTRY as Record<string, WidgetDefinition<unknown>>)[id] ?? null
}

/**
 * 新 space 的預設 Home 版面。
 *
 * Milestone B 只放「現在真的能用」的三個 widget（Q6：無假按鈕）。
 * daily_card / surprise_box / agent_message 要等 Milestone D、E 才有內容，
 * 屆時再加入預設版面。
 */
export function defaultLayoutItems(): GridItem[] {
  return [
    { id: 'theme_switcher', x: 0, y: 0, w: 4, h: 2 },
    { id: 'background_control', x: 4, y: 0, w: 3, h: 2 },
    { id: 'quick_note', x: 7, y: 0, w: 5, h: 3 },
  ]
}
