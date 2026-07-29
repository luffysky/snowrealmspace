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
  // 獨立工具（無 Milestone 綁定，直接可用）
  'datetime',
  'anniversary',
  'countdown',
  'mini_calendar',
  'world_clock',
  'daily_words',
  // 互動小工具（狀態存在各自 config；純瀏覽器）
  'todo_list',
  'habit_tracker',
  'photo_frame',
  'breathing',
  'dice',
  'fortune',
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
  category: 'daily' | 'creative' | 'agent' | 'project' | 'system' | 'utility' | 'personal' | 'fun' | 'relax'
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

// 時間日期：全部用瀏覽器 Intl（民國 roc、農曆 chinese），不進網路。
// 顯示哪幾行由勾選決定；時間有幾種樣式。全部帶預設，設定面板才渲染得出來。
const datetimeConfig = z.object({
  showTime: z.boolean().default(true),
  timeStyle: z
    .enum([
      '24 時（時:分）',
      '24 時（時:分:秒）',
      '12 時（上午/下午 時:分）',
      '12 時（上午/下午 時:分:秒）',
    ])
    .default('24 時（時:分）'),
  showGregorian: z.boolean().default(true),
  showWeekday: z.boolean().default(true),
  showRoc: z.boolean().default(false),
  showLunar: z.boolean().default(false),
})

// ── 個人 / 工具類新 widget（純瀏覽器，不連網、不取位置）────────────
// 紀念日：從某一天算到今天已經幾天（日期只算到「日」，忽略時間）。
const anniversaryConfig = z.object({
  title: z.string().default('紀念日'),
  sinceDate: z.string().default(''),
  showDays: z.boolean().default(true),
})

// 倒數計時：距離某個目標日還有幾天（可選顯示時分，逐秒走針）。
const countdownConfig = z.object({
  title: z.string().default('倒數'),
  targetDate: z.string().default(''),
  showTime: z.boolean().default(false),
})

// 迷你月曆：顯示本月，今天高亮。可選顯示今天的農曆。
const miniCalendarConfig = z.object({
  showLunar: z.boolean().default(false),
})

// 世界時鐘：最多四個時區，各以可讀標籤選擇，逐分走針。
// enum 值是「可讀標籤」，元件內用 ZONES 對照到 IANA 時區。
const WORLD_CLOCK_ZONES = [
  '台北',
  '東京',
  '首爾',
  '上海',
  '曼谷',
  '新加坡',
  '倫敦',
  '巴黎',
  '紐約',
  '洛杉磯',
  '雪梨',
  '杜拜',
  '—（不顯示）',
] as const

const worldClockConfig = z.object({
  zone1: z.enum(WORLD_CLOCK_ZONES).default('台北'),
  zone2: z.enum(WORLD_CLOCK_ZONES).default('—（不顯示）'),
  zone3: z.enum(WORLD_CLOCK_ZONES).default('—（不顯示）'),
  zone4: z.enum(WORLD_CLOCK_ZONES).default('—（不顯示）'),
  use24h: z.boolean().default(true),
})

// 每日情話：一行一句，依日期挑一句（同一天穩定、換天才變）。
const dailyWordsConfig = z.object({
  title: z.string().default('每日情話'),
  phrases: z.string().default(''),
})

// ── 互動小工具（狀態寫回各自 config，合併保留背景鍵）────────────
// 待辦清單：items 在小工具內編輯（設定面板不處理陣列），title 可在面板改。
const todoItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  done: z.boolean(),
})

const todoListConfig = z.object({
  title: z.string().default('待辦'),
  items: z.array(todoItemSchema).default([]),
})

// 習慣追蹤：checkins 是 YYYY-MM-DD 當地日期字串陣列，在小工具內勾選。
const habitTrackerConfig = z.object({
  title: z.string().default('習慣'),
  checkins: z.array(z.string()).default([]),
})

// 相框：從素材庫選一張圖（assetId 由設定面板的 AssetPicker 挑，不是文字框）。
const photoFrameConfig = z.object({
  assetId: z.string().default(''),
  frame: z.enum(['圓角', '方框', '無邊', '拍立得']).default('圓角'),
  caption: z.string().default(''),
})

// 呼吸練習：純動畫，無狀態。依 pattern 決定各階段秒數。
const breathingConfig = z.object({
  pattern: z.enum(['箱式 4-4-4-4', '4-7-8 放鬆', '深呼吸 5-5']).default('箱式 4-4-4-4'),
})

// 骰子決定器：骰子 / 硬幣 / 自訂選項（自訂時一行一個）。
const diceConfig = z.object({
  mode: z.enum(['骰子 1-6', '擲硬幣', '自訂選項']).default('骰子 1-6'),
  options: z.string().default(''),
})

// 幸運籤：一行一句自訂；留空用內建溫柔籤。
const fortuneConfig = z.object({
  fortunes: z.string().default(''),
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

  datetime: def({
    id: 'datetime',
    name: '時間日期',
    version: '1.0.0',
    category: 'utility',
    description: '時鐘 + 西元/民國/農曆日期，可勾選顯示',
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 2, h: 1 },
    maxSize: { w: 5, h: 3 },
    configSchema: datetimeConfig,
    defaultConfig: datetimeConfig.parse({}),
    // 純瀏覽器 Intl，不連網、不取位置
    permissions: [],
    // 自己每秒 tick，不需伺服器刷新
    refreshPolicy: { onMount: true },
  }),

  anniversary: def({
    id: 'anniversary',
    name: '紀念日',
    version: '1.0.0',
    category: 'personal',
    description: '從某一天算到今天已經幾天。',
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 2, h: 1 },
    maxSize: { w: 5, h: 3 },
    configSchema: anniversaryConfig,
    defaultConfig: anniversaryConfig.parse({}),
    permissions: [],
    refreshPolicy: { onMount: true },
  }),

  countdown: def({
    id: 'countdown',
    name: '倒數計時',
    version: '1.0.0',
    category: 'personal',
    description: '距離某個日子還有幾天。',
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 2, h: 1 },
    maxSize: { w: 5, h: 3 },
    configSchema: countdownConfig,
    defaultConfig: countdownConfig.parse({}),
    permissions: [],
    refreshPolicy: { onMount: true },
  }),

  mini_calendar: def({
    id: 'mini_calendar',
    name: '迷你月曆',
    version: '1.0.0',
    category: 'utility',
    description: '本月月曆，今天高亮。',
    defaultSize: { w: 3, h: 3 },
    minSize: { w: 3, h: 3 },
    maxSize: { w: 5, h: 5 },
    configSchema: miniCalendarConfig,
    defaultConfig: miniCalendarConfig.parse({}),
    permissions: [],
    refreshPolicy: { onMount: true },
  }),

  world_clock: def({
    id: 'world_clock',
    name: '世界時鐘',
    version: '1.0.0',
    category: 'utility',
    description: '同時看幾個城市的現在時間。',
    defaultSize: { w: 3, h: 3 },
    minSize: { w: 2, h: 2 },
    maxSize: { w: 5, h: 5 },
    configSchema: worldClockConfig,
    defaultConfig: worldClockConfig.parse({}),
    permissions: [],
    refreshPolicy: { onMount: true },
  }),

  daily_words: def({
    id: 'daily_words',
    name: '每日情話',
    version: '1.0.0',
    category: 'personal',
    description: '每天換一句，一行一句自己寫。',
    defaultSize: { w: 4, h: 2 },
    minSize: { w: 3, h: 1 },
    maxSize: { w: 6, h: 3 },
    configSchema: dailyWordsConfig,
    defaultConfig: dailyWordsConfig.parse({}),
    permissions: [],
    refreshPolicy: { onMount: true },
  }),

  todo_list: def({
    id: 'todo_list',
    name: '待辦清單',
    version: '1.0.0',
    category: 'utility',
    description: '勾掉今天要做的事。',
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
    maxSize: { w: 6, h: 8 },
    configSchema: todoListConfig,
    defaultConfig: todoListConfig.parse({}),
    permissions: [],
    refreshPolicy: { onMount: true },
  }),

  habit_tracker: def({
    id: 'habit_tracker',
    name: '習慣追蹤',
    version: '1.0.0',
    category: 'personal',
    description: '每天打卡，看連續幾天。',
    defaultSize: { w: 4, h: 3 },
    minSize: { w: 3, h: 2 },
    maxSize: { w: 6, h: 5 },
    configSchema: habitTrackerConfig,
    defaultConfig: habitTrackerConfig.parse({}),
    permissions: [],
    refreshPolicy: { onMount: true },
  }),

  photo_frame: def({
    id: 'photo_frame',
    name: '相框',
    version: '1.0.0',
    category: 'personal',
    description: '擺一張喜歡的照片。',
    defaultSize: { w: 3, h: 3 },
    minSize: { w: 2, h: 2 },
    maxSize: { w: 6, h: 6 },
    configSchema: photoFrameConfig,
    defaultConfig: photoFrameConfig.parse({}),
    permissions: [],
    refreshPolicy: { onMount: true },
  }),

  breathing: def({
    id: 'breathing',
    name: '呼吸練習',
    version: '1.0.0',
    category: 'relax',
    description: '跟著節奏慢慢呼吸。',
    defaultSize: { w: 3, h: 3 },
    minSize: { w: 3, h: 3 },
    maxSize: { w: 5, h: 5 },
    configSchema: breathingConfig,
    defaultConfig: breathingConfig.parse({}),
    permissions: [],
    refreshPolicy: { onMount: true },
  }),

  dice: def({
    id: 'dice',
    name: '骰子決定器',
    version: '1.0.0',
    category: 'fun',
    description: '交給運氣決定。',
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 2, h: 2 },
    maxSize: { w: 4, h: 4 },
    configSchema: diceConfig,
    defaultConfig: diceConfig.parse({}),
    permissions: [],
    refreshPolicy: { onMount: true },
  }),

  fortune: def({
    id: 'fortune',
    name: '幸運籤',
    version: '1.0.0',
    category: 'fun',
    description: '抽一支，給今天一句話。',
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 2, h: 2 },
    maxSize: { w: 5, h: 4 },
    configSchema: fortuneConfig,
    defaultConfig: fortuneConfig.parse({}),
    permissions: [],
    refreshPolicy: { onMount: true },
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
