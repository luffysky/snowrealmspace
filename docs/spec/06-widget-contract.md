# Widget 系統契約

> v1.0 §14 的 `configSchema: Record<string, unknown>` 等於沒定義，`permissions: string[]` 沒有列舉，格線系統只說「Desktop 12 欄」而沒有 row height、gap、碰撞規則與 RWD 轉換。本檔補齊。

---

## 1. 格線系統

| 斷點 | 寬度 | 欄數 | Row 高 | Gap |
|---|---|---|---|---|
| `desktop` | ≥ 1280px | 12 | 80px | 16px |
| `tablet` | 768–1279px | 8 | 80px | 16px |
| `mobile` | < 768px | — | — | 12px |

**Mobile 不使用格線。** 它是單欄垂直排序 —— widget 只有 `order` 與 `hidden`，沒有 x/y/w/h。這避免了「在 375px 寬度上拖曳 12 欄格線」這個本質上不可用的互動。

實際像素寬度：
```
columnWidth = (containerWidth - gap * (columns - 1)) / columns
widgetPixelWidth  = w * columnWidth + (w - 1) * gap
widgetPixelHeight = h * rowHeight   + (h - 1) * gap
```

### 1.1 座標儲存

```ts
// widget_instances.position
export type WidgetPosition = {
  desktop: { x: number; y: number; w: number; h: number }
  tablet:  { x: number; y: number; w: number; h: number }
  mobile:  { order: number }
}
```

**三個斷點各自獨立儲存。** 使用者在 desktop 調整位置不影響 tablet 的配置——這是「儲存多套版面」需求（v1.0 §7.2）的前提。

### 1.2 斷點間的自動推導

首次進入某個斷點且該斷點無配置時，從 desktop 推導：

```
desktop → tablet：
  w' = min(ceil(w * 8/12), 8)
  x' = min(round(x * 8/12), 8 - w')
  y' = y，然後跑一次重力壓縮（見 §2.2）

desktop → mobile：
  order = 依 (y, x) 排序後的索引
```

推導結果**立即持久化**，之後使用者的調整以持久化的為準，不再重新推導。

---

## 2. 佈局規則

### 2.1 碰撞

不允許重疊。拖曳時採**向下推擠（push-down）**：

```
移動 widget A 到與 B 重疊的位置
  → B 往下移動至剛好不重疊
  → B 的移動可能推擠 C，遞迴處理
  → 遞迴深度上限 20，超過則拒絕該次移動並回彈
```

不採用「交換位置」——那在多個 widget 大小不同時行為不可預測。

### 2.2 重力壓縮

每次佈局變更後執行：所有 widget 在不碰撞的前提下盡量往上移。這避免出現無法用拖曳消除的空洞。

```ts
export function compactLayout(items: GridItem[], columns: number): GridItem[]
```

純函式 → 100% 單元測試覆蓋。必測案例：空佈局、單一 widget、完全重疊、鋸齒狀空洞、超出欄數。

### 2.3 大小限制

伺服器端必須驗證（`04-api-contract.md` §5）：
```
minW ≤ w ≤ maxW
minH ≤ h ≤ maxH
0 ≤ x
x + w ≤ columns
```

超出時回 `422 UNPROCESSABLE`，不做靜默修正——靜默修正會讓前端與後端的認知不一致。

### 2.4 拖曳的儲存時機

**拖曳過程中不呼叫 API。** 只在 `dragEnd` / `resizeEnd` 時呼叫一次 `PATCH /api/layouts/:id/widgets/bulk`。

樂觀更新：立即更新本地狀態 → 呼叫 API → 失敗則回滾並顯示 toast。

---

## 3. WidgetDefinition

```ts
export type WidgetDefinition<TConfig = unknown> = {
  id: WidgetId                  // union type，非 string
  name: string
  version: string
  category: 'daily' | 'creative' | 'agent' | 'project' | 'system' | 'utility'
  description: string

  defaultSize: Size
  minSize: Size
  maxSize: Size

  configSchema: z.ZodType<TConfig>     // ← v1.0 是 Record<string, unknown>，等於沒定義
  defaultConfig: TConfig

  permissions: WidgetPermission[]
  featureFlag?: FeatureFlagKey

  // 資料需求宣告 —— 讓 Home Space 能批次預取，避免 N 個 widget 各打各的 API
  dataRequirements: DataRequirement[]

  refreshPolicy: {
    onMount: boolean
    intervalSeconds?: number     // null = 不自動更新
    onEvents?: DomainEventType[] // 這些事件發生時重新取資料
  }
}

export type WidgetId =
  | 'daily_card' | 'surprise_box' | 'agent_message' | 'current_project'
  | 'recent_designs' | 'quick_note' | 'theme_switcher' | 'background_control'
  | 'timeline_preview'
  // Future（v1.0 §14.3）
  | 'calendar' | 'focus_timer' | 'music' | 'weather' | 'mood_checkin'
  | 'inspiration_board' | 'goal_tracker' | 'figma_changes' | 'canva_export'
  | 'creative_streak' | 'shared_messages'

export type WidgetPermission =
  | 'read:daily' | 'read:designs' | 'read:projects' | 'read:themes'
  | 'read:timeline' | 'read:agent' | 'read:memories'
  | 'write:notes' | 'write:themes' | 'write:backgrounds'
  | 'network:external'          // 需要打外部 API（如天氣）
  | 'location'                  // 需要定位
```

`permissions` 從 `string[]` 改為列舉的意義：`network:external` 與 `location` 兩個權限讓「使用者可控制是否連接外部服務」（v1.0 §5.1）能在 widget 層級落實。天氣 widget 必須宣告這兩個權限，未取得同意前不可安裝。

---

## 4. 各 Widget 的 config schema

Birthday Alpha 的九個：

```ts
export const WIDGET_CONFIGS = {
  daily_card: z.object({
    showArchiveLink: z.boolean().default(true),
    compact: z.boolean().default(false),
  }),

  surprise_box: z.object({
    autoOpenOnLogin: z.boolean().default(false),
    showRarityLabel: z.boolean().default(true),
  }),

  agent_message: z.object({
    showAvatar: z.boolean().default(true),
    maxMessages: z.number().int().min(1).max(5).default(1),
    allowQuickReply: z.boolean().default(true),
  }),

  current_project: z.object({
    projectId: z.string().uuid().nullable().default(null),  // null = 最近活動的專案
    showProgress: z.boolean().default(true),
    showRecentAssets: z.boolean().default(true),
  }),

  recent_designs: z.object({
    limit: z.number().int().min(2).max(12).default(6),
    projectId: z.string().uuid().nullable().default(null),
    layout: z.enum(['grid','carousel']).default('grid'),
  }),

  quick_note: z.object({
    placeholder: z.string().max(80).default('隨手記下…'),
    autoSaveSeconds: z.number().int().min(2).max(30).default(5),
    targetProjectId: z.string().uuid().nullable().default(null),
  }),

  theme_switcher: z.object({
    showFavoritesOnly: z.boolean().default(false),
    limit: z.number().int().min(3).max(12).default(6),
  }),

  background_control: z.object({
    showPlaylistName: z.boolean().default(true),
    allowSkip: z.boolean().default(true),
    allowPause: z.boolean().default(true),   // ADR-019：影片必須可暫停
  }),

  timeline_preview: z.object({
    limit: z.number().int().min(3).max(10).default(5),
    view: z.enum(['recent','on_this_day']).default('recent'),
  }),
} as const
```

`configSchema` 用 zod 而非裸 JSON Schema 的理由：型別能推導到 React 元件的 props，設定面板可自動產生，且前後端共用同一份驗證。

---

## 5. 錯誤隔離（v1.0 §14.6）

```tsx
<WidgetErrorBoundary
  widgetId={instance.id}
  definitionId={instance.widgetDefinitionId}
  onError={reportWidgetError}
>
  <WidgetRenderer instance={instance} />
</WidgetErrorBoundary>
```

必須行為：

| 情況 | 行為 |
|---|---|
| 渲染錯誤 | 顯示 fallback 卡片（**保留原本的格線位置與大小**），不影響其他 widget |
| Fallback 內容 | widget 名稱 + 「暫時無法顯示」+ 重新載入按鈕 |
| 重新載入 | 重設 error boundary 並重新掛載，不重整頁面 |
| 連續失敗 3 次 | 顯示「停用此 widget」選項 |
| 錯誤記錄 | 寫入 `activity_events`（`widget.error`），含 definitionId 與版本，**不含使用者內容** |
| 資料取得失敗 | 與渲染錯誤區分：顯示「載入失敗」+ 重試，保留 widget 外框 |

**保留位置**這點很重要：如果 fallback 縮成一個小方塊，整個佈局會塌陷重排，使用者會以為自己的配置壞了。

---

## 6. 資料預取

N 個 widget 各自打 API 會讓 Home Space 首屏發出 10+ 個請求。作法：

```ts
export type DataRequirement =
  | { kind: 'daily_today' }
  | { kind: 'recent_designs'; limit: number }
  | { kind: 'project'; id: string | null }
  | { kind: 'themes'; favoritesOnly: boolean; limit: number }
  | { kind: 'timeline'; limit: number; view: string }
  | { kind: 'agent_latest' }
  | { kind: 'background_current' }
  | { kind: 'surprises_available' }
```

Home Space 的 Server Component：
1. 讀取 active layout 的所有 widget instance
2. 收集全部 `dataRequirements`，去重與合併（兩個 widget 都要 `recent_designs` 時取較大的 limit）
3. 單次批次查詢
4. 以 React `cache()` 提供給各 widget

結果：首屏一次 DB round-trip，而非 N 次。

---

## 7. Widget 註冊

```ts
// packages/widget-engine/src/registry.ts
export const WIDGET_REGISTRY: Record<WidgetId, WidgetDefinition> = { ... }

// 元件以 dynamic import 註冊，不進首屏 bundle
export const WIDGET_COMPONENTS: Record<WidgetId, LazyComponent> = {
  daily_card:    lazy(() => import('@/features/daily/DailyCardWidget')),
  surprise_box:  lazy(() => import('@/features/daily/SurpriseBoxWidget')),
  // ...
}
```

**每個 widget 的元件必須 code-split。** 未被使用的 widget 不應出現在 bundle 中——這對「Future Widgets」清單（v1.0 §14.3 有 11 個）尤其重要。

啟動時的一致性檢查（開發模式）：
- `WIDGET_REGISTRY` 的每個 key 都有對應的 `WIDGET_COMPONENTS`
- 每個 definition 的 `defaultSize` 落在 min/max 之間
- 每個 definition 在 DB 的 `widget_definitions` 表有對應列
- 不一致時 throw，不靜默略過

---

## 8. 無障礙（v1.0 §43）

拖曳必須有鍵盤替代方案。這是 WCAG 2.2 的硬需求，不是加分項。

| 操作 | 鍵盤 |
|---|---|
| 進入編輯模式 | `E` |
| 選取 widget | `Tab` |
| 移動 | 方向鍵（一格一步） |
| 調整大小 | `Shift` + 方向鍵 |
| 確認 | `Enter` |
| 取消 | `Esc`（回到移動前的位置） |
| 隱藏 | `H` |

其他要求：
- 每次移動後以 `aria-live="polite"` 播報「每日卡片，第 3 欄第 2 列，寬 4 高 2」
- 編輯模式的 widget 有 `role="application"` 與 `aria-roledescription="可拖曳的區塊"`
- 拖曳中的視覺提示不得只靠顏色（v1.0 §43）

---

## 9. 效能

| 目標 | 值 |
|---|---|
| 拖曳幀率 | 盡可能 60fps（v1.0 §42.1） |
| 拖曳時的 DOM 更新 | 只用 `transform`，不改 `top`/`left` |
| Re-render 範圍 | 只有被拖曳的 widget 與被推擠的 widget |
| 佈局計算 | 在 `requestAnimationFrame` 中，不在 event handler |
| Widget 數量上限 | 每個 layout 60 個 |

超過 30 個 widget 時，視窗外的 widget 使用 `content-visibility: auto`。

---

## 10. 驗收條件

```gherkin
Scenario: 拖曳後重整仍保留
  When 使用者拖曳 widget 並放開
  And 重新整理頁面
  Then widget 位於放開時的位置

Scenario: 單一 widget 錯誤不影響其他
  Given daily_card widget 渲染時拋出例外
  When Home Space 渲染
  Then 其他 8 個 widget 正常顯示
  And daily_card 位置顯示 fallback 且大小不變

Scenario: 斷點推導只做一次
  Given 使用者只在 desktop 配置過
  When 首次以 tablet 寬度開啟
  Then 系統推導出 tablet 配置並持久化
  When 使用者調整 tablet 配置後再次開啟
  Then 顯示使用者調整後的配置，不重新推導

Scenario: 伺服器拒絕超界的大小
  When 送出 w 超過該 widget 的 maxSize.w
  Then 回 422 UNPROCESSABLE
  And 資料庫未變更

Scenario: 鍵盤可完成拖曳
  Given 使用者只用鍵盤
  When 按 E 進入編輯、Tab 選取、方向鍵移動、Enter 確認
  Then widget 位置更新
  And 螢幕閱讀器播報新位置

Scenario: 重力壓縮消除空洞
  Given 佈局中 y=0 為空、y=1 有 widget
  When 執行 compactLayout
  Then 該 widget 移至 y=0

Scenario: 未啟用 flag 的 widget 不可安裝
  Given feature.weather 為 false
  When 查詢 GET /api/widget-definitions
  Then 回應中不含 weather
  When 直接 POST 安裝 weather widget
  Then 回 404
```
