# API 契約

> v1.0 §35 只列了 30 條路徑，無 request/response、無錯誤碼、無驗證規則，且缺 assets / widgets / layouts / daily / surprise / timeline / search / settings / export 端點。本檔補齊。
> 所有 schema 以 zod 定義於 `packages/validation/`，前後端共用。

---

## 0. 通則

### 認證
所有 `/api/*` 端點（除 `/api/health`、`/api/auth/*`、`/api/webhooks/*`）都需要有效的 Supabase session cookie。

### Space 範圍
所有涉及 space 資料的端點都需要 `X-Space-Id` header。伺服器驗證呼叫者是該 space 成員；不是則回 `403`。**絕不從 body 或 query 取 space_id**——那會讓 IDOR 攻擊面暴露在請求體。

### 統一回應格式

```ts
// 成功
{ "data": T, "meta"?: { "page": {...} } }

// 失敗
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "人類可讀訊息（zh-TW）",
    "details"?: { "fieldErrors": { "name": ["名稱不可為空"] } },
    "requestId": "req_..."
  }
}
```

### 錯誤碼

| HTTP | code | 使用時機 |
|---|---|---|
| 400 | `VALIDATION_FAILED` | zod 驗證失敗，`details.fieldErrors` 必填 |
| 401 | `UNAUTHENTICATED` | 無 session |
| 403 | `FORBIDDEN` | 非 space 成員 |
| 403 | `INSUFFICIENT_ROLE` | 需要 owner 但呼叫者是 guest |
| 404 | `NOT_FOUND` | 資源不存在**或**功能 flag 關閉（ADR-018） |
| 409 | `CONFLICT` | 版本衝突 |
| 409 | `HAS_REFERENCES` | 刪除 asset 但有引用，`details.references` 必填 |
| 413 | `QUOTA_EXCEEDED` | 儲存配額，`details.{used,limit}` 必填 |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | 檔案類型不允許 |
| 422 | `UNPROCESSABLE` | 語意錯誤（如把影片設為 gradient 型別） |
| 429 | `RATE_LIMITED` | `Retry-After` header 必填 |
| 429 | `AI_QUOTA_EXCEEDED` | AI 額度，`details.resetAt` 必填 |
| 502 | `PROVIDER_ERROR` | 外部 provider 失敗，`details.provider` 必填 |
| 503 | `AI_UNAVAILABLE` | 所有 AI 候選失敗（`12-ai-model-routing.md` §10） |

**規則：** 錯誤訊息一律 zh-TW 且對使用者有意義。禁止把原始 exception message 回傳給前端。

### 分頁
游標式，不用 offset：
```
GET /api/assets?limit=30&cursor=eyJjcmVhdGVkQXQiOi4uLn0
→ { data: [...], meta: { page: { nextCursor: "...", hasMore: true } } }
```
`limit` 上限 100，預設 30。

### 速率限制

| 類別 | 限制 |
|---|---|
| 一般讀取 | 300 / 分 / user |
| 一般寫入 | 60 / 分 / user |
| 上傳意圖 | 30 / 分 / user |
| AI 對話 | 見 ADR-021 |
| 匯出 | 3 / 日 / space |

### 冪等
所有 `POST` 建立類端點接受 `Idempotency-Key` header。24 小時內相同 key 回傳首次結果。

---

## 1. Auth 與 Space

```
POST   /api/auth/magic-link          寄送登入連結
POST   /api/auth/verify-invite       驗證邀請 token
POST   /api/auth/signout

GET    /api/spaces                   我可存取的 space 列表
POST   /api/spaces                   建立（需有效邀請）
GET    /api/spaces/:id
PATCH  /api/spaces/:id               owner
DELETE /api/spaces/:id               owner，需二次確認

GET    /api/spaces/:id/settings
PATCH  /api/spaces/:id/settings      owner
GET    /api/spaces/:id/usage         儲存與 AI 用量
```

```ts
// PATCH /api/spaces/:id/settings
export const updateSettingsSchema = z.object({
  motionPreference: z.enum(['system','full','reduced','none']).optional(),
  soundEnabled: z.boolean().optional(),
  agentMode: z.enum(['companion','creative_director','design_reviewer','organizer','focus_partner','quiet']).optional(),
  agentTone: z.string().max(40).optional(),
  agentProactive: z.enum(['off','important_only','daily','adaptive','custom']).optional(),
  agentVisible: z.boolean().optional(),
  memoryEnabled: z.boolean().optional(),
  aiAnalysisEnabled: z.boolean().optional(),
  activityTracking: z.boolean().optional(),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  quietHoursEnd:   z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  weatherEnabled: z.boolean().optional(),
  weatherCity: z.string().max(80).nullable().optional(),
  timezone: z.string().max(64).optional(),
}).strict()
```

**關閉開關的副作用必須明確定義**（v1.0 §5.1、§32.3）：

| 從 true → false | 副作用 |
|---|---|
| `memoryEnabled` | 既有記憶**保留但停止檢索**。UI 顯示「已停用，N 筆記憶被保留」+ 刪除全部的按鈕 |
| `aiAnalysisEnabled` | 停止新分析。既有 `design_insights` 保留，UI 標示為歷史結果 |
| `activityTracking` | 停止寫入 `activity_events`。Timeline 停止新增。既有保留 |
| `providerDataEnabled` | 所有 connection 轉 `paused`，webhook 忽略 |

---

## 2. Assets

```
POST   /api/assets/upload-intent     取得 signed PUT URL
POST   /api/assets/:id/complete      上傳完成通知
GET    /api/assets                   列表（篩選：kind, projectId, tag, q）
GET    /api/assets/:id
PATCH  /api/assets/:id               只能改 original_filename
DELETE /api/assets/:id               ?cascade=true 一併刪引用
GET    /api/assets/:id/references    誰在用這個 asset
GET    /api/assets/:id/url           取得 signed 讀取 URL（15 分鐘）
```

```ts
// POST /api/assets/upload-intent
export const uploadIntentSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().max(120),
  bytes: z.number().int().positive().max(52_428_800),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),      // SHA-256 hex
}).strict()

// 200 —— 新上傳
{ data: { assetId, uploadUrl, expiresAt, headers: {...} } }
// 200 —— 已存在（去重命中，客戶端跳過上傳）
{ data: { assetId, deduplicated: true } }
// 413 —— 配額
{ error: { code:'QUOTA_EXCEEDED', details:{ used: 5_100_000_000, limit: 5_368_709_120 } } }
```

**MIME 白名單**（ADR-019、ADR-022）：
```ts
const ALLOWED = {
  image: ['image/png','image/jpeg','image/webp','image/gif','image/avif'],
  video: ['video/mp4','video/webm'],
  pdf:   ['application/pdf'],
}
```
`complete` 端點必須以**檔案內容** magic bytes 重新偵測 MIME，與宣稱值不符則標記 `failed` 並刪除 R2 物件。

```ts
// GET /api/assets/:id/references → 409 刪除失敗時同結構
{ data: { references: [
  { type: 'design_snapshot', id, label: '六月海報 v3', href: '/design/...' },
  { type: 'background_item', id, label: '夜晚版背景',   href: '/studio/background/...' },
] } }
```

---

## 3. Theme

```
GET    /api/themes
POST   /api/themes
GET    /api/themes/:id
PATCH  /api/themes/:id
DELETE /api/themes/:id
POST   /api/themes/:id/apply
POST   /api/themes/:id/duplicate
GET    /api/themes/:id/versions
POST   /api/themes/:id/versions          建立版本快照
POST   /api/themes/:id/versions/:v/restore
GET    /api/themes/:id/export            → application/json 下載
POST   /api/themes/import                multipart 或 JSON body
POST   /api/themes/from-image            從 asset 取色（本地，同步）
POST   /api/themes/from-mood             從文字描述（AI，非同步）
POST   /api/themes/check-contrast        即時對比檢查（純計算，無副作用）
```

```ts
// POST /api/themes/from-image —— 本地演算法，同步回傳（ADR-012）
export const themeFromImageSchema = z.object({
  assetId: z.string().uuid(),
  variants: z.number().int().min(1).max(5).default(3),
}).strict()

// 200，p95 < 3 秒（v1.0 §42.1）
{ data: { drafts: [ { definition: ThemeDefinition, palette: {...}, a11yReport: {...} } ] } }

// POST /api/themes/from-mood —— AI，非同步
{ data: { jobId: '...', status: 'queued' } }   // 202
```

```ts
// POST /api/themes/check-contrast
{ pairs: [{ fg: '#38252d', bg: '#fff7fb', size: 'normal' | 'large' | 'ui' }] }
→ { data: { results: [{ ratio: 12.4, passesAA: true, passesAAA: true, required: 4.5 }] } }
```

**匯入安全（ADR-020）：** `definition` 必須通過完整 zod schema，所有顏色欄位必須匹配 `/^#[0-9a-f]{6}$/i` 或合法 `rgba()`。**拒絕任何含 `url(`、`expression(`、`javascript:`、`</` 的字串值。**

---

## 4. Background

```
GET    /api/backgrounds
POST   /api/backgrounds
PATCH  /api/backgrounds/:id
DELETE /api/backgrounds/:id

GET    /api/background-playlists
POST   /api/background-playlists
PATCH  /api/background-playlists/:id
DELETE /api/background-playlists/:id
POST   /api/background-playlists/:id/activate
POST   /api/background-playlists/:id/items
DELETE /api/background-playlists/:id/items/:itemId
PATCH  /api/background-playlists/:id/items/reorder
GET    /api/background-playlists/current   依排程解析出當下應顯示的背景
```

```ts
// PATCH .../items/reorder
{ orderedItemIds: z.array(z.string().uuid()).min(1).max(200) }
// 必須在單一 transaction 內完成（利用 deferrable unique constraint）

// GET /api/background-playlists/current
{ data: {
  current: BackgroundItem,
  next?: BackgroundItem,          // 供預載（v1.0 §12.6：僅預載下一張）
  switchAt?: string,              // ISO，何時切換
  transition: 'fade', transitionMs: 800,
} }
```

---

## 5. Layout 與 Widget

```
GET    /api/layouts
POST   /api/layouts
PATCH  /api/layouts/:id
DELETE /api/layouts/:id
POST   /api/layouts/:id/activate
POST   /api/layouts/:id/reset            還原為預設配置

GET    /api/widget-definitions           已啟用且 flag 開啟的
POST   /api/layouts/:id/widgets          新增實例
PATCH  /api/widgets/:id                  位置 / 大小 / config
DELETE /api/widgets/:id
PATCH  /api/layouts/:id/widgets/bulk     拖曳後批次存位置
```

```ts
// PATCH /api/layouts/:id/widgets/bulk —— 拖曳結束時呼叫一次，非每次移動
export const bulkWidgetSchema = z.object({
  breakpoint: z.enum(['desktop','tablet','mobile']),
  items: z.array(z.object({
    id: z.string().uuid(),
    x: z.number().int().min(0),
    y: z.number().int().min(0),
    w: z.number().int().min(1),
    h: z.number().int().min(1),
  })).max(60),
}).strict()
```

伺服器必須驗證 `w`/`h` 落在該 widget definition 的 min/max 範圍內，且無重疊（見 `06-widget-contract.md` §3）。

---

## 6. Project 與 Design

```
GET    /api/projects
POST   /api/projects
GET    /api/projects/:id
PATCH  /api/projects/:id
DELETE /api/projects/:id
GET    /api/projects/:id/activity

GET    /api/design/files
POST   /api/design/files                 從既有 asset 建立作品
GET    /api/design/files/:id
PATCH  /api/design/files/:id
DELETE /api/design/files/:id
POST   /api/design/files/:id/sync        外部 provider 才有
GET    /api/design/files/:id/snapshots
POST   /api/design/files/:id/snapshots   上傳新版（帶 assetId）

GET    /api/design/snapshots/:id
POST   /api/design/snapshots/:id/analyze        AI 深度分析（202）
GET    /api/design/snapshots/:id/features       本地分析結果（同步）
POST   /api/design/snapshots/:id/create-theme
POST   /api/design/snapshots/compare            兩個 snapshot 比較
DELETE /api/design/snapshots/:id
```

```ts
// POST /api/design/snapshots/:id/analyze
{ depth: z.enum(['light','deep']).default('light') }
// light → design_vision_light（免費模型）
// deep  → design_vision_deep（付費，扣 ADR-021 額度）
// 202 { data: { jobId, estimatedSeconds } }
// 若 aiAnalysisEnabled = false → 403 { code: 'FORBIDDEN', message: '請先於設定開啟 AI 分析' }

// GET /api/design/snapshots/:id/features —— 純本地，永遠同步、永遠免費
{ data: {
  colors: { dominant, secondary, accent, palette: [...], count: 7 },
  contrast: { averageRatio: 5.2, failingRegions: 0.03, wcagLevel: 'AA' },
  layout: { whitespaceRatio: 0.42, dominantEdgeDirection: 'horizontal' },
  dimensions: { width, height, aspectRatio },
  computedAt: '...',
} }
```

**回應中 vision 產出的每一條陳述都必須帶分類與 confidence**（ADR-012、v1.0 §21.4）：
```ts
{ data: { statements: [
  { category: 'metric',    text: '這個版本使用 5 種顏色，比上版少 3 種。',
    evidence: { metric: 'color_count', value: 5, comparison: 8, sourceIds: ['snap_a','snap_b'] },
    confidence: 1.0 },
  { category: 'inference', text: '整體調性比前一版更安靜。',
    evidence: { sourceIds: ['snap_b'] }, confidence: 0.62 },
] } }
```

---

## 7. Agent

```
GET    /api/agent/threads
POST   /api/agent/threads
GET    /api/agent/threads/:id
DELETE /api/agent/threads/:id
POST   /api/agent/threads/:id/messages     SSE 串流
POST   /api/agent/messages/:id/stop        中止串流

GET    /api/agent/actions                  待確認的動作
POST   /api/agent/actions/:id/confirm
POST   /api/agent/actions/:id/reject
POST   /api/agent/actions/:id/undo
```

```ts
// POST /api/agent/threads/:id/messages
export const sendMessageSchema = z.object({
  content: z.string().min(1).max(4000),
  attachments: z.array(z.object({
    type: z.enum(['asset','snapshot','theme','project']),
    id: z.string().uuid(),
  })).max(5).default([]),
  requestDepth: z.boolean().default(false),   // true → agent_chat_deep（付費）
}).strict()
```

SSE 事件格式：
```
event: start
data: {"messageId":"...","model":"...","isFree":true,"degraded":false}

event: delta
data: {"text":"我看了"}

event: statement
data: {"category":"metric","text":"...","evidence":{...},"confidence":1.0}

event: tool_call
data: {"actionId":"...","tool":"apply_theme","input":{...},"requiresConfirmation":true}

event: done
data: {"tokensInput":1240,"tokensOutput":310,"escalated":false}

event: error
data: {"code":"AI_UNAVAILABLE","message":"AI 暫時忙線","retryable":true}
```

`error` 事件後**前端必須保留使用者輸入**（v1.0 §46.2）。

---

## 8. Memory

```
GET    /api/memories                     ?status=approved|proposed|all
POST   /api/memories                     使用者手動新增（直接 approved）
PATCH  /api/memories/:id
DELETE /api/memories/:id
POST   /api/memories/:id/approve
POST   /api/memories/:id/reject
DELETE /api/memories                     刪除全部（需確認字串）
GET    /api/memories/export
```

**強制規則：** `POST /api/memories` 若 `sourceType !== 'user_explicit'` → `422`。Agent 只能透過 tool 建立 `approved = false` 的提案。

`memoryEnabled = false` 時，除 `GET`、`DELETE`、`export` 外全部回 `403`。

---

## 9. Daily、Surprise、Timeline

```
GET    /api/daily/today
GET    /api/daily/archive
POST   /api/daily/:id/open               標記 delivered
GET    /api/surprises
POST   /api/surprises/:id/unlock
POST   /api/surprises/:id/favorite

GET    /api/timeline                     ?view=chronological|project|year|category
GET    /api/timeline/on-this-day
PATCH  /api/timeline/:id                 改標題 / visibility
DELETE /api/timeline/:id
```

```ts
// GET /api/daily/today
{ data: {
  items: [{ id, kind, title, body, payload, status, isNew: true }],
  localDate: '2026-07-23',
  nextRefreshAt: '2026-07-24T04:00:00+08:00',
} }
```

---

## 10. Search

```
GET    /api/search?q=...&types=asset,design,theme,project,memory&limit=20
```

Birthday Alpha 只做 metadata 層（v1.0 §29.1）：名稱、tag、project、類型、日期。使用 `pg_trgm`。

`feature.semanticSearch` 開啟後才加入向量搜尋，回應多一個 `matchType: 'exact' | 'fuzzy' | 'semantic'` 欄位。

---

## 11. Integration

```
GET    /api/integrations                          可用 provider + capability matrix
POST   /api/integrations/:provider/connect        → 302 到 OAuth
GET    /api/integrations/:provider/callback
POST   /api/integrations/:connectionId/disconnect ?purgeData=true
GET    /api/integrations/:connectionId/files
POST   /api/integrations/:connectionId/files/:fileId/link
POST   /api/integrations/:connectionId/sync
POST   /api/webhooks/:provider                    無 session，驗簽章
```

```ts
// GET /api/integrations —— 前端只顯示實際支援的功能（v1.0 §20.2）
{ data: { providers: [{
  id: 'figma',
  connected: false,
  featureFlag: 'figmaIntegration',
  capabilities: {
    canListFiles: true, canReadStructure: true, canExportPreview: true,
    canListVersions: true, supportsWebhook: true, supportsInEditorApp: false,
  },
}] } }
```

**flag 關閉的 provider 不出現在此清單，且其所有端點回 404**（ADR-018）。

`disconnect?purgeData=true` 刪除該 connection 的所有派生資料（design_files、snapshots、對應的 assets）。`purgeData=false` 則保留但標記 `sync_status = 'paused'`。UI 必須讓使用者明確選擇，不可預設。

---

## 12. 隱私與帳號

```
POST   /api/account/export               → 202，完成後寄連結
GET    /api/account/export/:id/download
DELETE /api/account                      需輸入 email 確認
GET    /api/privacy/ai-disclosure        v1.0 §32.4 的聲明內容
GET    /api/privacy/data-map             哪些資料存在哪裡
```

---

## 13. Cron（內部）

```
POST   /api/cron/daily-generate
POST   /api/cron/token-refresh
POST   /api/cron/insight-weekly
POST   /api/cron/storage-gc
POST   /api/cron/queue-health
```

全部要求 `Authorization: Bearer ${CRON_SECRET}`，且以 constant-time 比較。這些端點**只入列 job，不做實際工作**（ADR-007）。

---

## 14. 每個端點的測試要求（ADR-017）

```ts
describe('POST /api/themes', () => {
  it('200：合法輸入建立主題')
  it('400：name 為空 → VALIDATION_FAILED 且 details.fieldErrors.name 存在')
  it('401：無 session')
  it('403：非該 space 成員')
  it('冪等：相同 Idempotency-Key 回傳同一筆')
})
```

四個案例（成功 / 驗證失敗 / 未認證 / 越權）是每個端點的最低門檻，不可省略第三與第四項。
