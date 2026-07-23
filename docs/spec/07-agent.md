# Agent — 可執行規格

> v1.0 §21 / §39 定義了 Agent 該是什麼，但沒有 system prompt、10 個 tool 沒有一個有 schema、沒有 context 預算、沒有 rollback 機制。本檔補齊全部。
> 模型選擇與路由見 `12-ai-model-routing.md`。

---

## 1. 五分類是這個 Agent 的核心

v1.0 §21.4 的 Fact / Metric / Inference / Suggestion / Creative 是整份憲章最好的設計。它是 §4.4「AI 常做沒有證據的推測」與 §5.2「證據優先」的執行機制。**但 v1.0 沒有定義輸出格式，等於沒有實作。**

```ts
export type StatementCategory = 'fact' | 'metric' | 'inference' | 'suggestion' | 'creative'

export type Statement = {
  category: StatementCategory
  text: string
  evidence: {
    metric?: string          // 指標名稱，如 'color_count'
    value?: number
    comparison?: number      // 對照值（前一版、平均）
    sourceIds: string[]      // asset / snapshot / event 的 id
  }
  confidence: number         // 0–1
}
```

### 各分類的硬規則

| 分類 | 定義 | `sourceIds` | `confidence` | 產生方式 |
|---|---|---|---|---|
| `fact` | 系統中可查證的事實 | **必須非空** | 恆為 `1.0` | 從 DB 讀出，不經 LLM |
| `metric` | 可計算的數值 | **必須非空** | 恆為 `1.0` | 本地演算法（ADR-012） |
| `inference` | 從資料推論 | **必須非空** | `< 1.0`，且 **≤ 0.85** | LLM |
| `suggestion` | 建議做什麼 | 可空 | `< 1.0` | LLM |
| `creative` | 創意內容（比喻、命名、文案） | 可空 | 不適用，填 `null` | LLM |

**`inference` 的 confidence 上限 0.85 是刻意的。** 推論永遠不該表現得跟事實一樣確定。這個上限在後處理層強制執行，不靠 prompt 自律：

```ts
function clampStatement(s: Statement): Statement {
  if (s.category === 'fact' || s.category === 'metric') {
    if (!s.evidence.sourceIds?.length) throw new InvalidStatementError(s)
    return { ...s, confidence: 1.0 }
  }
  if (s.category === 'inference') {
    if (!s.evidence.sourceIds?.length) throw new InvalidStatementError(s)
    return { ...s, confidence: Math.min(s.confidence ?? 0.5, 0.85) }
  }
  return s
}
```

拋出 `InvalidStatementError` 時的處理：**丟棄該條陳述**，不丟棄整個回應。並記錄到 `ai_usage_log.error` 供分析——若某模型頻繁產出無證據的 fact，那個模型不該用在這個 usage key。

### UI 呈現規則

| 分類 | 呈現 |
|---|---|
| `fact` / `metric` | 一般文字。可點擊 `sourceIds` 跳到來源 |
| `inference` | 前綴標示「推測」+ confidence 條。**必須視覺上與 fact 有區別** |
| `suggestion` | 前綴標示「建議」，附「採用」/「不需要」按鈕 |
| `creative` | 一般文字，但整段標示為創意內容 |

**禁止**把 inference 與 metric 用相同樣式呈現。這是 v1.0 §4.4 的直接落實。

---

## 2. System Prompt

檔案：`prompts/agent/system-v1.md`。**必須以 `PROMPT_CACHE_MARKER` 切分**（見 `12-ai-model-routing.md` §3.3b）。

### 2.1 穩定前綴（所有 space 完全相同 → 跨使用者共用 cache）

```markdown
你是 SnowRealm Space 中的常駐 AI 夥伴。

## 你是什麼
- 助手、創作夥伴、這個空間的居民、設計評論者、整理者。

## 你不是什麼
- 你不是全知的。你只知道這則訊息中明確提供給你的內容。
- 你不是情緒診斷工具。不評論使用者的心理狀態、情緒或健康。
- 你不能存取任何未提供給你的檔案、對話或外部服務。
- 你不能在未經確認的情況下執行有副作用的操作。

## 最重要的規則：不要假裝看過沒看過的東西

如果使用者提到某個作品、專案或主題，但它不在下方的「當前脈絡」中，
你必須直接說你看不到，並請對方選取它。

錯誤示範：
  使用者：「你覺得我那張海報怎麼樣？」
  ❌「你的海報配色很和諧，層次分明。」   ← 你根本沒看到那張海報

正確示範：
  ✅「我現在看不到那張海報。你可以在 Design Hub 選取它，或直接拖進對話裡，
     我就能看了。」

## 陳述分類

你的每一句實質內容都必須歸入以下五類之一，並以結構化格式輸出：

- fact       系統中可查證的事實。必須指出來源 id。
- metric     可計算的數值。必須指出來源 id 與指標名稱。
- inference  從資料推論出的判斷。必須指出來源 id，信心值不得超過 0.85。
- suggestion 建議採取的行動。
- creative   創意內容：命名、比喻、文案、描述。

**你不得自行計算任何數值。** 顏色數量、對比比值、留白比例這類數據
一律由系統的本地分析提供，會出現在下方的脈絡中。若脈絡中沒有某個數值，
你就說沒有這項資料，不要估算。

## 語氣

- 溫暖但不諂媚。不要每句話都稱讚。
- 具體優於抽象。「這裡的對比是 2.8:1，低於可讀標準」勝過「這裡有點難讀」。
- 簡短。除非對方要求詳細說明，否則不要超過三段。
- 使用繁體中文。技術名詞可保留英文。

## 禁止事項

- 不製造焦慮、不使用假稀缺、不假倒數、不情緒勒索。
- 不宣稱你想念使用者、離不開使用者，或對使用者有感情依賴。
- 不評論使用者的外貌、身體、感情狀態或財務狀況。
- 不在使用者沒問的情況下反覆提醒未完成的事。一次就好。
- 不使用「你最近很焦慮」「你的設計成熟了」這類無資料支撐的斷言。
```

### 2.2 個人化後綴（每個 space 不同 → 不 cache）

```markdown
## 當前脈絡

時間：{{localTime}}（{{timezone}}）
Space：{{spaceName}}
目前頁面：{{currentRoute}}

{{#if activeTheme}}
### 目前主題
名稱：{{activeTheme.name}}
主色：{{activeTheme.colors.primary}}／輔色：{{activeTheme.colors.secondary}}
字體：標題 {{activeTheme.typography.headingFont}}、內文 {{activeTheme.typography.bodyFont}}
{{/if}}

{{#if selectedSnapshot}}
### 使用者選取的作品
標題：{{selectedSnapshot.title}}
版本建立於：{{selectedSnapshot.createdAt}}
{{#if selectedSnapshot.projectName}}所屬專案：{{selectedSnapshot.projectName}}{{/if}}

本地分析（這些是可信的計算結果，可直接引用為 metric）：
{{#each selectedSnapshot.localFeatures}}
- {{@key}}：{{this}}
{{/each}}

{{#if selectedSnapshot.imageAttached}}
這張作品的圖片已附在本次訊息中，你可以直接觀察它。
{{else}}
⚠️ 圖片未附上，你只有上述數值，不得描述畫面內容。
{{/if}}
{{/if}}

{{#if currentProject}}
### 目前專案
{{currentProject.name}}（狀態：{{currentProject.status}}）
{{currentProject.description}}
最近活動：{{currentProject.lastActivityAt}}
{{/if}}

{{#if memories.length}}
### 使用者已批准你記住的事
{{#each memories}}
- {{this.content}}
{{/each}}

這些是使用者主動同意保存的。你可以自然地運用，但不要每次都刻意提起。
{{/if}}

{{#if recentActivity.length}}
### 最近活動
{{#each recentActivity}}
- {{this.occurredAt}}：{{this.description}}
{{/each}}
{{/if}}

## 可用工具

{{#each availableTools}}
- {{this.name}}：{{this.description}}{{#if this.requiresConfirmation}}（需使用者確認）{{/if}}
{{/each}}

{{#unless memoryEnabled}}
記憶功能目前為關閉狀態。你不得提議記住任何事，也不得引用任何記憶。
{{/unless}}
```

**`imageAttached` 那個分支是關鍵。** 沒有它，模型會根據標題與數值編出畫面描述——這正是 v1.0 §4.4 要防的幻覺。

---

## 3. Context Builder

### 3.1 Token 預算與裁切優先序

單次請求輸入上限 30,000 token（ADR-021）。超過時**依此順序裁切**，先裁最下面的：

| 優先序 | 內容 | 預算 | 裁切方式 |
|---|---|---|---|
| 1 | System prompt 穩定前綴 | ~2,000 | 永不裁切 |
| 2 | 當前使用者訊息 | ~1,000 | 永不裁切；超過 4000 字在 API 層就擋掉 |
| 3 | 選取的作品 + 本地分析 | ~2,000 | 永不裁切（使用者明確選了它） |
| 4 | 附加的圖片 | ~1,500/張，最多 3 張 | 超過 3 張只保留前 3 張並告知 |
| 5 | 當前主題與頁面 | ~400 | 永不裁切 |
| 6 | 已批准記憶 | ~2,000 | 依相關度排序（embedding），取前 N 條 |
| 7 | 對話歷史 | ~15,000 | 保留最近 N 輪；更早的以摘要取代 |
| 8 | 最近活動 | ~1,000 | 取最近 10 筆 |
| 9 | 相關 Insight | ~800 | 取最近 3 筆 |

```ts
export async function buildContext(input: {
  spaceId: string
  threadId: string
  userMessage: string
  attachments: Attachment[]
  budgetTokens: number
}): Promise<{ system: string; messages: AIMessage[]; truncated: string[] }>
```

`truncated` 回傳被裁掉的區塊名稱。若對話歷史被裁切，**必須在回應中告知使用者**「較早的對話已摘要」——靜默遺忘會讓使用者覺得 Agent 突然變笨且無法理解原因。

### 3.2 記憶檢索

```
1. memoryEnabled = false → 回傳空陣列，結束
2. 對使用者訊息取 embedding（usage key: 'embedding'，免費）
3. pgvector 檢索 approved = true 且未過期的記憶，cosine 相似度前 20
4. 過濾 similarity < 0.65 的
5. 依 sensitivity 排除 'restricted'
6. 取前 8 條，或到達 2000 token 為止
```

**`sensitivity = 'restricted'` 的記憶永不進入 context。** 它們只在使用者於 Memory Center 主動查看時顯示。

### 3.3 對話歷史摘要

超過 15,000 token 時，最舊的一半以 `agent_chat`（免費模型）摘要成一段 400 token 的文字，存進 `agent_threads.summary`，之後複用。摘要只做一次，不重複生成。

---

## 4. Tool 定義

v1.0 §39.3 列了 10 個 tool 名字，一個 schema 都沒有。以下是完整定義。

### 4.1 共同結構

```ts
export type ToolDefinition = {
  name: string
  description: string
  inputSchema: object            // JSON Schema
  permission: Permission         // 需要的權限
  requiresConfirmation: boolean  // v1.0 §21.5
  auditAction: string            // 寫入 audit_logs.action
  undoable: boolean
  buildUndoPayload?: (before: unknown) => unknown
}

export type Permission =
  | 'notes:write' | 'projects:write' | 'themes:write' | 'themes:apply'
  | 'backgrounds:write' | 'assets:tag' | 'daily:write' | 'memory:propose'
  | 'design:read'
```

### 4.2 十個 Tool

```ts
export const AGENT_TOOLS: ToolDefinition[] = [
  {
    name: 'create_note',
    description: '建立一則筆記，可選擇歸屬某個專案。',
    inputSchema: {
      type: 'object',
      properties: {
        title:     { type: 'string', maxLength: 120 },
        body:      { type: 'string', maxLength: 8000 },
        projectId: { type: 'string', format: 'uuid' },
      },
      required: ['body'],
      additionalProperties: false,
    },
    permission: 'notes:write',
    requiresConfirmation: false,     // 新增內容，無破壞性
    auditAction: 'agent.note.created',
    undoable: true,
  },

  {
    name: 'create_project',
    description: '建立新專案。只在使用者明確表達要開始一個新專案時使用。',
    inputSchema: {
      type: 'object',
      properties: {
        name:        { type: 'string', minLength: 1, maxLength: 80 },
        description: { type: 'string', maxLength: 2000 },
        status:      { type: 'string', enum: ['idea','active'] },
        tags:        { type: 'array', items: { type: 'string', maxLength: 24 }, maxItems: 10 },
      },
      required: ['name'],
      additionalProperties: false,
    },
    permission: 'projects:write',
    requiresConfirmation: false,
    auditAction: 'agent.project.created',
    undoable: true,
  },

  {
    name: 'create_theme_draft',
    description: '建立一份主題草稿供使用者預覽。草稿不會自動套用。',
    inputSchema: {
      type: 'object',
      properties: {
        name:       { type: 'string', maxLength: 80 },
        definition: { $ref: '#/definitions/ThemeDefinition' },
        rationale:  { type: 'string', maxLength: 600,
                      description: '為什麼這樣配。會顯示給使用者。' },
      },
      required: ['name','definition'],
      additionalProperties: false,
    },
    permission: 'themes:write',
    requiresConfirmation: false,      // 草稿無副作用
    auditAction: 'agent.theme.drafted',
    undoable: true,
  },

  {
    name: 'apply_theme',
    description: '把某個主題套用到 Home Space。這會改變整個空間的外觀。',
    inputSchema: {
      type: 'object',
      properties: { themeId: { type: 'string', format: 'uuid' } },
      required: ['themeId'],
      additionalProperties: false,
    },
    permission: 'themes:apply',
    requiresConfirmation: true,       // ← v1.0 §21.5 明列
    auditAction: 'agent.theme.applied',
    undoable: true,
    buildUndoPayload: (before) => ({ previousThemeId: (before as Space).activeThemeId }),
  },

  {
    name: 'create_palette',
    description: '產生一組配色供使用者參考。不會建立主題。',
    inputSchema: {
      type: 'object',
      properties: {
        mood:   { type: 'string', maxLength: 60 },
        baseColor: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
        count:  { type: 'integer', minimum: 3, maximum: 8 },
      },
      required: ['mood'],
      additionalProperties: false,
    },
    permission: 'themes:write',
    requiresConfirmation: false,
    auditAction: 'agent.palette.created',
    undoable: false,                  // 無持久化副作用
  },

  {
    name: 'add_background',
    description: '把某個作品或圖片加入背景清單。',
    inputSchema: {
      type: 'object',
      properties: {
        assetId:    { type: 'string', format: 'uuid' },
        playlistId: { type: 'string', format: 'uuid' },
        settings:   { type: 'object' },
      },
      required: ['assetId'],
      additionalProperties: false,
    },
    permission: 'backgrounds:write',
    requiresConfirmation: false,
    auditAction: 'agent.background.added',
    undoable: true,
  },

  {
    name: 'compare_design_versions',
    description: '比較同一作品的兩個版本。回傳本地計算的差異數據。',
    inputSchema: {
      type: 'object',
      properties: {
        snapshotIdA: { type: 'string', format: 'uuid' },
        snapshotIdB: { type: 'string', format: 'uuid' },
      },
      required: ['snapshotIdA','snapshotIdB'],
      additionalProperties: false,
    },
    permission: 'design:read',
    requiresConfirmation: false,
    auditAction: 'agent.design.compared',
    undoable: false,
  },

  {
    name: 'tag_asset',
    description: '為作品加上標籤。一次最多 10 個 asset。',
    inputSchema: {
      type: 'object',
      properties: {
        assetIds: { type: 'array', items: { type: 'string', format: 'uuid' },
                    minItems: 1, maxItems: 10 },
        tags:     { type: 'array', items: { type: 'string', maxLength: 24 },
                    minItems: 1, maxItems: 10 },
        mode:     { type: 'string', enum: ['add','replace'] },
      },
      required: ['assetIds','tags'],
      additionalProperties: false,
    },
    permission: 'assets:tag',
    // 3 個以上 asset 或 mode='replace' 時需確認（v1.0 §21.5「大量修改 Tag」）
    requiresConfirmation: true,
    auditAction: 'agent.assets.tagged',
    undoable: true,
    buildUndoPayload: (before) => ({ previousTags: before }),
  },

  {
    name: 'create_daily_card',
    description: '為今天建立一張每日卡片。同一天同類型只能有一張。',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', maxLength: 80 },
        body:  { type: 'string', maxLength: 500 },
        kind:  { type: 'string', enum: ['daily_card','agent_note','creative_prompt'] },
      },
      required: ['body','kind'],
      additionalProperties: false,
    },
    permission: 'daily:write',
    requiresConfirmation: false,
    auditAction: 'agent.daily.created',
    undoable: true,
  },

  {
    name: 'save_memory_proposal',
    description: '提議記住某件事。這只會建立提案，需要使用者按下同意才會保存。',
    inputSchema: {
      type: 'object',
      properties: {
        content:     { type: 'string', minLength: 4, maxLength: 500 },
        type:        { type: 'string', enum: ['preference','project_context','design_taste','habit','milestone','other'] },
        rationale:   { type: 'string', maxLength: 300,
                       description: '為什麼你認為這值得記住。會顯示給使用者。' },
        sensitivity: { type: 'string', enum: ['normal','private'] },
      },
      required: ['content','type'],
      additionalProperties: false,
    },
    permission: 'memory:propose',
    requiresConfirmation: false,     // 提案本身無副作用；批准才是動作
    auditAction: 'agent.memory.proposed',
    undoable: true,
  },
]
```

### 4.3 需要確認的動作

v1.0 §21.5 列了 8 種。對應到本實作：

| v1.0 列出的行為 | 落實方式 |
|---|---|
| 套用主題 | `apply_theme.requiresConfirmation = true` |
| 大量修改 Tag | `tag_asset` 在 ≥3 個 asset 或 `mode='replace'` 時要求確認 |
| 刪除 | **Agent 沒有刪除 tool。** 完全不提供 |
| 封存 | **Agent 沒有封存 tool。** 完全不提供 |
| 中斷連線 | **Agent 沒有此 tool** |
| 對外分享 | **Agent 沒有此 tool** |
| 上傳到第三方 | **Agent 沒有此 tool** |
| 寫入外部設計文件 | **Agent 沒有此 tool** |

**最後六項的處理方式是「不給工具」而非「要求確認」。** 對於不可逆且高風險的操作，最安全的權限模型是根本不存在那個能力。Agent 可以在對話中告訴使用者「你可以在設定裡中斷連線」，但不能代勞。

---

## 5. Tool 執行流程

```
LLM 產生 tool_call
    ↓
1. 驗證：input 通過 JSON Schema？→ 否則丟棄該 call 並告知模型
    ↓
2. 權限檢查：呼叫者角色有此 permission？→ 否則回錯誤給模型
    ↓
3. Flag 檢查：相關 feature flag 開啟？→ 否則回「此功能目前不可用」
    ↓
4. 建立 agent_actions 記錄（status='pending_confirmation' 或 'approved'）
    ↓
5. requiresConfirmation？
   ├─ 是 → SSE 送出 tool_call 事件，等待使用者
   │        使用者確認 → POST /api/agent/actions/:id/confirm → 進 6
   │        使用者拒絕 → status='rejected'，告知模型，繼續對話
   │        60 秒未回應 → 保持 pending，對話可繼續（不阻塞）
   └─ 否 → 直接進 6
    ↓
6. 執行前先擷取 undo_payload（若 undoable）
    ↓
7. 執行。成功 → status='executed'；失敗 → status='failed' + error
    ↓
8. 寫 audit_logs + 發出 domain event
    ↓
9. 結果回饋給模型，模型產生後續回應
```

### 5.1 Undo

```
POST /api/agent/actions/:id/undo
  ├─ status 必須為 'executed'
  ├─ undoable 必須為 true
  ├─ 執行時間必須在 24 小時內
  ├─ 套用 undo_payload
  └─ status='rolled_back'，undone_at=now()
```

Undo 按鈕在該則 Agent 訊息旁顯示 24 小時。這是 v1.0 §39.3「所有 Tool 必須定義 rollback behavior」的具體實作。

### 5.2 Tool calling 需要付費模型

免費模型的 tool calling 支援度不一致且不可靠。因此：

**任何請求只要 `tools` 非空，就走 `agent_chat_deep`（付費）**，並計入 ADR-021 的付費額度。

在 UI 上，觸發 tool 的訊息會顯示為「深入模式」。若付費額度用盡，Agent 降級為純對話：它會告訴使用者「我可以幫你套用這個主題，但今天的深入模式額度用完了，你可以直接在 Theme Studio 按套用」——**給出可行的替代路徑，而不是單純說做不到**。

---

## 6. 主動訊息

### 6.1 觸發條件（v1.0 §21.6）

| 觸發 | 條件 | 頻率上限 |
|---|---|---|
| 每日卡片 | 當日 daily_item 生成完成且使用者尚未開啟 | 1/日 |
| 新作品同步 | provider webhook 帶來新版本 | 3/日 |
| 版本變更 | snapshot checksum 改變 | 3/日 |
| 專案停滯 | `status='active'` 且 `last_activity_at` > 14 天 | 1/**14 日**/專案 |
| 週報 | 當地時間週一 09:00 | 1/週 |
| 里程碑 | 達成條件 | 不限（但里程碑本身稀有） |
| Provider 失敗 | connection 轉 `error` | 1/連線/日 |
| 新洞察 | insight 生成且 confidence ≥ 0.7 | 1/日 |

**總上限 3 則/日**（ADR-021），超過的丟棄而非排隊。

### 6.2 硬性禁止（v1.0 §5.5）

主動訊息生成後、送出前必須通過過濾器：

```ts
const FORBIDDEN_PATTERNS = [
  /連續\s*\d+\s*天沒(有)?來/,      // 連續登入中斷羞辱
  /只剩\s*\d+\s*(小時|分鐘)/,        // 假倒數
  /最後機會|即將消失|錯過就沒了/,     // 假稀缺
  /我(很)?想念你|我等你|沒有你/,      // 情緒勒索
  /你是不是(不喜歡|放棄)/,
]

function passesProactiveFilter(text: string): boolean {
  return !FORBIDDEN_PATTERNS.some(re => re.test(text))
}
```

未通過的訊息**丟棄不送**，並記錄以供 prompt 調整。這比在 prompt 裡寫「不要情緒勒索」可靠——後者無法保證。

### 6.3 Quiet Mode

`agent_mode = 'quiet'` 或在 `quiet_hours` 內：
- 不送出任何主動訊息
- 生成的訊息存起來，下次使用者主動開啟 Agent 時最多顯示 1 則
- 使用者主動提問時 Agent 正常回應（quiet 只影響主動性）

---

## 7. 錯誤處理（v1.0 §46.2）

| 情況 | 行為 |
|---|---|
| 所有候選失敗 | SSE `error` 事件 + **保留使用者輸入** + 重試按鈕 |
| Timeout（60s） | 明確顯示「回應超時」，與其他錯誤區分 |
| 模型拒絕回答 | 顯示模型的拒絕理由，**不重寫、不假裝成別的錯誤** |
| 額度用盡 | 顯示重置時間；免費額度用盡才停用輸入框 |
| Tool 執行失敗 | 該 tool 標記 failed，Agent 繼續對話並說明哪一步沒成功 |
| 結構化輸出解析失敗 | 觸發升級重試（`12-ai-model-routing.md` §4.4）；仍失敗則顯示原始文字並標示「格式異常」 |

**絕不生成假結果。** 如果 Agent 無法完成分析，它說無法完成，不編一個看起來合理的答案。

---

## 8. 驗收條件

```gherkin
Feature: Agent 不假裝看過未提供的內容

  Scenario: 使用者提到未選取的作品
    Given 使用者沒有選取任何作品
    When 使用者問「你覺得我那張海報怎麼樣」
    Then 回應中不得出現對畫面內容的描述
    And 回應必須包含如何提供該作品的指引

  Scenario: 只有數值沒有圖片
    Given 選取的 snapshot 有 localFeatures 但 imageAttached 為 false
    When 使用者要求分析
    Then 回應只能引用 localFeatures 中存在的數值
    And 不得描述畫面的視覺內容

Feature: 陳述分類

  Scenario: metric 必須有來源
    When Agent 產生 category='metric' 的陳述
    Then evidence.sourceIds 非空
    And confidence 等於 1.0

  Scenario: inference 信心上限
    When 模型回傳 category='inference' 且 confidence=0.95
    Then 後處理後 confidence 為 0.85

  Scenario: 無證據的 fact 被丟棄
    When 模型回傳 category='fact' 且 sourceIds 為空
    Then 該條陳述不出現在回應中
    And 其餘陳述正常顯示

Feature: 需確認的動作

  Scenario: 套用主題需要確認
    When Agent 呼叫 apply_theme
    Then 主題不會立即套用
    And 前端收到 requiresConfirmation=true 的 tool_call 事件
    And agent_actions 該筆 status 為 'pending_confirmation'

  Scenario: 拒絕後對話繼續
    Given Agent 提議套用主題
    When 使用者按下拒絕
    Then status 為 'rejected'
    And Agent 能繼續回應且不重複提議同一個主題

  Scenario: 復原已套用的主題
    Given Agent 已套用主題 B（原本是 A）
    When 使用者在 24 小時內按下復原
    Then space.active_theme_id 回到 A
    And status 為 'rolled_back'

  Scenario: Agent 無刪除能力
    When 使用者要求 Agent 刪除某個作品
    Then Agent 不呼叫任何刪除 tool
    And Agent 告知使用者可以自行刪除的位置

Feature: 記憶

  Scenario: 記憶關閉時不提案
    Given memoryEnabled 為 false
    When 使用者說出明顯的偏好
    Then Agent 不呼叫 save_memory_proposal
    And context 中不含任何記憶

  Scenario: 提案需批准
    When Agent 呼叫 save_memory_proposal
    Then memories 該筆 approved 為 false
    And 該記憶不會出現在下一次對話的 context 中

  Scenario: restricted 記憶不進 context
    Given 存在 sensitivity='restricted' 且 approved=true 的記憶
    When 建立對話 context
    Then 該記憶不出現在 context 中

Feature: 主動訊息

  Scenario: 情緒勒索被攔截
    Given 生成的主動訊息含「你已經 5 天沒來了」
    Then 該訊息不送出
    And 不佔用當日 3 則額度

  Scenario: Quiet hours
    Given 現在在 quiet_hours 範圍內
    When 觸發主動訊息條件
    Then 不送出通知
    And 訊息保留至使用者下次主動開啟 Agent
```

---

## 9. Prompt 版本管理（v1.0 §40）

```
prompts/
  agent/
    system-v1.md              穩定前綴 + 個人化後綴模板
    design-review-v1.md
    theme-generator-v1.md
    memory-proposal-v1.md
    daily-card-v1.md
    proactive-v1.md
    thread-summary-v1.md
```

每個檔案的 frontmatter：

```yaml
---
id: agent.system
version: 1
usageKey: agent_chat
temperature: 0.7
maxTokens: 2000
inputSchema: ./system-v1.input.json
outputSchema: ./statement-array.schema.json
owner: product
updatedAt: 2026-07-23
changelog:
  - v1 初版
---
```

**Prompt 內容變更必須升版號，不得原地修改。** 舊版保留，`ai_usage_log` 記錄使用的 prompt 版本，讓「換了 prompt 後品質變差」可以被追溯與回滾。
