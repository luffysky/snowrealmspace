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

// ── Future widgets（本次實作四個）────────────────────
const focusTimerConfig = z.object({
  workMinutes: z.number().int().min(5).max(90).default(25),
  breakMinutes: z.number().int().min(1).max(30).default(5),
  rounds: z.number().int().min(1).max(12).default(4),
})

const creativeStreakConfig = z.object({
  windowDays: z.number().int().min(7).max(90).default(30),
})

const moodCheckinConfig = z.object({
  showHistory: z.boolean().default(true),
})

const goalTrackerConfig = z.object({
  showCompleted: z.boolean().default(false),
})

const weatherConfig = z.object({
  // 扁平布林：關掉就只顯示日/夜、氣溫、地區，不跑動畫
  showAnimation: z.boolean().default(true),
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
    defaultSize: { w: 4, h: 3 },
    minSize: { w: 3, h: 3 },
    maxSize: { w: 6, h: 5 },
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

  focus_timer: def({
    id: 'focus_timer',
    name: '專注計時',
    version: '1.0.0',
    category: 'utility',
    description: '番茄鐘。工作／休息輪替。',
    defaultSize: { w: 3, h: 3 },
    minSize: { w: 3, h: 3 },
    maxSize: { w: 5, h: 4 },
    configSchema: focusTimerConfig,
    defaultConfig: focusTimerConfig.parse({}),
    permissions: [],
    refreshPolicy: { onMount: false },
  }),

  creative_streak: def({
    id: 'creative_streak',
    name: '創作連續',
    version: '1.0.0',
    category: 'creative',
    description: '你連續幾天有動手。',
    defaultSize: { w: 4, h: 2 },
    minSize: { w: 3, h: 2 },
    maxSize: { w: 6, h: 4 },
    configSchema: creativeStreakConfig,
    defaultConfig: creativeStreakConfig.parse({}),
    permissions: ['read:timeline'],
    refreshPolicy: { onMount: true, intervalSeconds: 600 },
  }),

  mood_checkin: def({
    id: 'mood_checkin',
    name: '心情打卡',
    version: '1.0.0',
    category: 'daily',
    description: '今天過得怎麼樣。',
    defaultSize: { w: 4, h: 3 },
    minSize: { w: 3, h: 2 },
    maxSize: { w: 6, h: 5 },
    configSchema: moodCheckinConfig,
    defaultConfig: moodCheckinConfig.parse({}),
    permissions: [],
    refreshPolicy: { onMount: true },
  }),

  goal_tracker: def({
    id: 'goal_tracker',
    name: '目標追蹤',
    version: '1.0.0',
    category: 'project',
    description: '想達成的事，一步步推進。',
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
    maxSize: { w: 6, h: 8 },
    configSchema: goalTrackerConfig,
    defaultConfig: goalTrackerConfig.parse({}),
    permissions: [],
    refreshPolicy: { onMount: true },
  }),

  weather: def({
    id: 'weather',
    name: '天氣',
    version: '1.0.0',
    category: 'utility',
    description: '你所在城市的目前天氣。',
    defaultSize: { w: 3, h: 3 },
    minSize: { w: 2, h: 2 },
    maxSize: { w: 5, h: 4 },
    configSchema: weatherConfig,
    defaultConfig: weatherConfig.parse({}),
    // location：城市名由使用者在設定填；network:external：走 Open-Meteo
    permissions: ['location', 'network:external'],
    featureFlag: 'weatherWidget',
    // 每 15 分鐘刷新（後端有 ~10 分鐘快取）
    refreshPolicy: { onMount: true, intervalSeconds: 900 },
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
 * daily_card 放最上方最寬的位置 —— 它是每天第一眼看到的內容（Milestone E）。
 * 只放「現在真的能用」的 widget（Q6：無假按鈕）；agent_message 等各自的 Milestone 有內容再加入。
 */
export function defaultLayoutItems(): GridItem[] {
  return [
    { id: 'daily_card', x: 0, y: 0, w: 6, h: 3 },
    { id: 'surprise_box', x: 6, y: 0, w: 6, h: 3 },
    { id: 'agent_message', x: 0, y: 3, w: 6, h: 2 },
    { id: 'theme_switcher', x: 6, y: 3, w: 3, h: 2 },
    { id: 'background_control', x: 9, y: 3, w: 3, h: 2 },
    { id: 'quick_note', x: 0, y: 5, w: 4, h: 3 },
  ]
}

/**
 * 版面範本：不同工作狀態用不同排版。使用者可從這幾套建立新版面，之後自由增減。
 * 只用「已實作」的 widget（無假區塊）。12 欄格線，位置不重疊。
 */
export type LayoutPreset = { key: string; name: string; description: string; items: GridItem[] }

export const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    key: 'default',
    name: '預設',
    description: '每日內容 + 驚喜 + 隨手記，均衡的起點。',
    items: defaultLayoutItems(),
  },
  {
    key: 'focus',
    name: '專注',
    description: '番茄鐘 + 今天 + 目標 + 隨手記，把雜訊收起來做事。',
    items: [
      { id: 'focus_timer', x: 0, y: 0, w: 4, h: 3 },
      { id: 'daily_card', x: 4, y: 0, w: 8, h: 3 },
      { id: 'goal_tracker', x: 0, y: 3, w: 6, h: 4 },
      { id: 'quick_note', x: 6, y: 3, w: 6, h: 4 },
    ],
  },
  {
    key: 'creative',
    name: '創作',
    description: '目前專案 + 最近作品 + 連續天數 + 目標，給做東西的日子。',
    items: [
      { id: 'current_project', x: 0, y: 0, w: 6, h: 3 },
      { id: 'recent_designs', x: 6, y: 0, w: 6, h: 3 },
      { id: 'creative_streak', x: 0, y: 3, w: 4, h: 2 },
      { id: 'goal_tracker', x: 4, y: 3, w: 4, h: 4 },
      { id: 'quick_note', x: 8, y: 3, w: 4, h: 4 },
    ],
  },
  {
    key: 'daily',
    name: '每日',
    description: '每日卡 + 驚喜 + 心情 + Agent + 時間軸，慢慢過一天。',
    items: [
      { id: 'daily_card', x: 0, y: 0, w: 6, h: 3 },
      { id: 'surprise_box', x: 6, y: 0, w: 6, h: 3 },
      { id: 'mood_checkin', x: 0, y: 3, w: 4, h: 3 },
      { id: 'agent_message', x: 4, y: 3, w: 8, h: 2 },
      { id: 'timeline_preview', x: 4, y: 5, w: 4, h: 4 },
    ],
  },
  {
    key: 'minimal',
    name: '極簡',
    description: '只留每日卡與隨手記，越少越安靜。',
    items: [
      { id: 'daily_card', x: 0, y: 0, w: 7, h: 3 },
      { id: 'quick_note', x: 7, y: 0, w: 5, h: 3 },
    ],
  },
  {
    key: 'overview',
    name: '總覽',
    description: '一次看到最多：內容、專案、作品、時間軸、心情。',
    items: [
      { id: 'daily_card', x: 0, y: 0, w: 6, h: 3 },
      { id: 'current_project', x: 6, y: 0, w: 6, h: 3 },
      { id: 'recent_designs', x: 0, y: 3, w: 6, h: 3 },
      { id: 'timeline_preview', x: 6, y: 3, w: 4, h: 4 },
      { id: 'creative_streak', x: 0, y: 6, w: 4, h: 2 },
      { id: 'mood_checkin', x: 4, y: 6, w: 4, h: 3 },
      { id: 'quick_note', x: 8, y: 7, w: 4, h: 3 },
    ],
  },
]

export function layoutPreset(key: string): LayoutPreset | null {
  return LAYOUT_PRESETS.find((p) => p.key === key) ?? null
}
