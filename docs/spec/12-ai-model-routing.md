# 多模型路由層 — 可執行規格

> 實作 ADR-023。
> 移植自 `D:\SnowRealmRebirth\AI\ai_island_v3\src\lib\{ai-providers,ai-router,resolve-usage-ai,ai-usage-models,ai-cache}.ts`，該實作已在 AI 島線上驗證。
> 套件位置：`packages/ai-core/`

---

## 0. 為什麼需要這一層

沒有這層的話，每個功能都會出現這種程式碼：

```ts
// ❌ 反例：寫死廠商、寫死模型、額度用完就整個功能死掉
const res = await anthropic.messages.create({ model: 'claude-...', ... })
```

問題有四個：
1. 免費額度用完 → 功能直接壞掉，沒有備援。
2. 換模型要改 N 個檔案。
3. 生成一句「早安」跟做一次設計評論用同一個貴模型。
4. 成本無法歸因——不知道錢花在哪個功能。

這層解決全部四個。**任何 feature code 都不得直接呼叫任何 AI 廠商 API。**

---

## 1. 三層架構

```
┌─ 呼叫端（feature code）─────────────────────────────┐
│  completeForUsage('agent_chat', { system, user })   │  ← 只知道「用途」
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─ 路由層 resolve-usage.ts ───────────────────────────┐
│  1. 讀 ai_usage_models 拿該用途的有序候選鏈           │
│  2. circuit breaker：剛失敗的 provider 降到隊尾       │
│  3. 依序嘗試；缺 key 的候選跳過                       │
│  4. 額度/限流/下架 → 換下一個候選                     │
│  5. 低信心 → 升級到 escalate 候選重試一次             │
│  6. 全滅 → 撈任何 active 模型當保底                   │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─ Provider 層 providers.ts ──────────────────────────┐
│  三種協定：OpenAI 相容 / Anthropic / Google          │
│  九家 provider 全部收斂成 callAI() / streamAI()      │
└─────────────────────────────────────────────────────┘
```

---

## 2. 用途（usage key）定義

這是本產品與 AI 島最大的差異點。每個 usage key 代表一個「AI 任務類型」，各自有獨立的候選鏈與預設 tier。

```ts
// packages/ai-core/src/usage-keys.ts
export type AiUsageKey =
  // ── 對話 ──
  | 'agent_chat'              // Agent 一般對話（最高頻）
  | 'agent_chat_deep'         // 使用者主動要求深入分析 / 需要 tool calling
  | 'agent_proactive'         // 主動訊息生成
  // ── 設計 ──
  | 'design_vision_light'     // 風格標籤、語言判定（免費 vision 即可）
  | 'design_vision_deep'      // 完整設計評論（使用者主動觸發）
  | 'design_compare'          // 兩個 snapshot 的差異摘要
  // ── 主題 ──
  | 'theme_from_mood'         // 文字描述 → 主題草稿
  | 'theme_name'              // 幫主題取名
  | 'font_pairing'            // 字體配對建議
  // ── 每日內容 ──
  | 'daily_card'              // 每日卡片文案
  | 'daily_prompt'            // 創作提示
  | 'greeting'                // 問候語
  // ── 記憶與洞察 ──
  | 'memory_proposal'         // 從對話萃取記憶提案
  | 'insight_phrasing'        // 把統計數據寫成人話
  | 'weekly_recap'            // 週報
  // ── 工具 ──
  | 'asset_tagging'           // 自動 tag 建議
  | 'title_suggestion'        // 作品標題建議
  | 'embedding'               // 語意搜尋向量
```

### 2.1 預設候選鏈（seed 資料）

`role` 語意：
- `primary` — 第一個打
- `fallback` — 前面失敗才退（額度用盡 / 429 / 5xx / 模型下架）
- `escalate` — **不在正常路徑上**，只有低信心或明確要求時才用

```ts
// packages/ai-core/src/default-candidates.ts
// 模型名稱不寫死品牌型號在本文件；此處為結構示意，實際值 seed 進 ai_usage_models 表。
export const DEFAULT_CANDIDATES: Record<AiUsageKey, UsageCandidate[]> = {
  // 最高頻。全部免費，只有低信心才碰付費。
  agent_chat: [
    { model: 'groq:<free-fast-chat>',      role: 'primary'  },  // 延遲最低
    { model: 'cerebras:<free-chat>',       role: 'fallback' },
    { model: 'mistral:<free-chat>',        role: 'fallback' },
    { model: 'google:<free-flash>',        role: 'fallback' },
    { model: 'anthropic:<paid-fast>',      role: 'escalate' },  // ← 只有低信心才走
  ],

  // 使用者主動要求深入 / 需要 tool calling → 直接付費，不繞免費。
  agent_chat_deep: [
    { model: 'anthropic:<paid-main>',      role: 'primary'  },
    { model: 'anthropic:<paid-fast>',      role: 'fallback' },
    { model: 'google:<free-flash>',        role: 'fallback' },  // 預算用盡時的降級保底
  ],

  agent_proactive: [
    { model: 'cerebras:<free-chat>',       role: 'primary'  },
    { model: 'mistral:<free-chat>',        role: 'fallback' },
    { model: 'groq:<free-fast-chat>',      role: 'fallback' },
  ],

  // 免費層唯一可靠的 vision 是 Gemini Flash。
  design_vision_light: [
    { model: 'google:<free-flash-vision>', role: 'primary'  },
    { model: 'groq:<free-vision>',         role: 'fallback' },
    { model: 'openrouter:<free-vision>',   role: 'fallback' },
  ],

  // 使用者按下「請 Agent 分析」才會走到這裡。品質優先。
  design_vision_deep: [
    { model: 'anthropic:<paid-main>',      role: 'primary'  },
    { model: 'google:<free-flash-vision>', role: 'fallback' },
  ],

  design_compare: [
    { model: 'google:<free-flash-vision>', role: 'primary'  },
    { model: 'anthropic:<paid-fast>',      role: 'escalate' },
  ],

  // 以下全部只用免費層，無 escalate。
  theme_from_mood:  [{ model: 'groq:<free-fast-chat>', role: 'primary' }, { model: 'cerebras:<free-chat>', role: 'fallback' }],
  theme_name:       [{ model: 'groq:<free-fast-chat>', role: 'primary' }, { model: 'mistral:<free-chat>',  role: 'fallback' }],
  font_pairing:     [{ model: 'cerebras:<free-chat>',  role: 'primary' }, { model: 'groq:<free-fast-chat>',role: 'fallback' }],
  daily_card:       [{ model: 'cerebras:<free-chat>',  role: 'primary' }, { model: 'mistral:<free-chat>',  role: 'fallback' }, { model: 'groq:<free-fast-chat>', role: 'fallback' }],
  daily_prompt:     [{ model: 'mistral:<free-chat>',   role: 'primary' }, { model: 'cerebras:<free-chat>', role: 'fallback' }],
  greeting:         [{ model: 'groq:<free-fast-chat>', role: 'primary' }, { model: 'cerebras:<free-chat>', role: 'fallback' }],
  memory_proposal:  [{ model: 'cerebras:<free-chat>',  role: 'primary' }, { model: 'groq:<free-fast-chat>',role: 'fallback' }],
  insight_phrasing: [{ model: 'mistral:<free-chat>',   role: 'primary' }, { model: 'cerebras:<free-chat>', role: 'fallback' }],
  weekly_recap:     [{ model: 'cerebras:<free-chat>',  role: 'primary' }, { model: 'mistral:<free-chat>',  role: 'fallback' }],
  asset_tagging:    [{ model: 'groq:<free-fast-chat>', role: 'primary' }, { model: 'cerebras:<free-chat>', role: 'fallback' }],
  title_suggestion: [{ model: 'groq:<free-fast-chat>', role: 'primary' }, { model: 'cerebras:<free-chat>', role: 'fallback' }],
  embedding:        [{ model: 'google:<free-embedding>', role: 'primary' }],
}
```

**唯一會花錢的三個 usage key：** `agent_chat_deep`、`design_vision_deep`，以及 `agent_chat` 的 escalate 路徑。其餘 14 個全免費。

---

## 3. Provider 層

### 3.1 三種協定，九家 provider

```ts
// packages/ai-core/src/providers.ts
export type ProviderId =
  | 'anthropic'   // Anthropic 協定
  | 'google'      // Google 協定
  | 'openai' | 'groq' | 'openrouter' | 'cerebras'
  | 'nvidia' | 'sambanova' | 'mistral' | 'cloudflare'  // 皆 OpenAI 相容

export function endpointFor(provider: ProviderId): string {
  switch (provider) {
    case 'groq':       return 'https://api.groq.com/openai/v1/chat/completions'
    case 'openrouter': return 'https://openrouter.ai/api/v1/chat/completions'
    case 'cerebras':   return 'https://api.cerebras.ai/v1/chat/completions'
    case 'nvidia':     return 'https://integrate.api.nvidia.com/v1/chat/completions'
    case 'sambanova':  return 'https://api.sambanova.ai/v1/chat/completions'
    case 'mistral':    return 'https://api.mistral.ai/v1/chat/completions'
    case 'cloudflare':
      return `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/v1/chat/completions`
    case 'openai':     return 'https://api.openai.com/v1/chat/completions'
    case 'anthropic':  return 'https://api.anthropic.com/v1/messages'
    case 'google':     return 'https://generativelanguage.googleapis.com/v1beta'
  }
}
```

### 3.2 統一介面

```ts
export type AIContentBlock =
  | { type: 'text';  text: string }
  | { type: 'image'; mediaType: string; data: string }  // base64，不含 data: prefix

export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | AIContentBlock[]
}

export interface AICompletionRequest {
  provider: ProviderId
  model: string
  apiKey: string
  messages: AIMessage[]
  temperature?: number
  maxTokens?: number
  tools?: ToolDefinition[]      // 只有支援 tool calling 的 provider 會用
  responseSchema?: object       // JSON Schema，強制結構化輸出
  noFallback?: boolean          // 呼叫端自己管備援時設 true，避免雙重退避
}

export interface AICompletionResponse {
  text: string
  toolCalls?: ToolCall[]
  tokensInput: number
  tokensOutput: number
  cacheWriteTokens?: number     // Anthropic prompt cache
  cacheReadTokens?: number
  latencyMs: number
  raw?: unknown
}

export async function callAI(req: AICompletionRequest): Promise<AICompletionResponse>
export async function* streamAI(req: AICompletionRequest): AsyncGenerator<StreamChunk>
```

### 3.3 必須照搬的三個細節

這三個是 AI 島踩過坑後才有的，**不要重新發明**：

**(a) 落單 surrogate 清理**
`text.slice(0, N)` 剛好切在 emoji 中間 → 產生半個 UTF-16 surrogate → `JSON.stringify` 產出不合法 JSON → Anthropic 回 400。所有送出的文字都要過這個函式：

```ts
export function stripLoneSurrogates(s: string): string {
  if (!s) return s
  return s.replace(
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
    '',
  )
}
```

**(b) Anthropic prompt cache 邊界標記**
用四個零寬空格當標記，把 system prompt 切成「全站共用的穩定前綴」與「每個 space 不同的後綴」。前綴設為 cache breakpoint，可跨使用者跨對話命中。

```ts
export const PROMPT_CACHE_MARKER = '​​​​'
```

對本產品的意義：Agent 的 system prompt（人格、規則、Fact/Metric/Inference 分類定義）約 2000+ token 且**所有 space 完全相同**，放前綴；當前主題、選取的作品、已批准記憶放後綴。cache read 只算 0.1× 費率。

**(c) 計費用的等效 input token**

```ts
export function billableInputTokens(input: number, cacheWrite = 0, cacheRead = 0): number {
  return input + cacheWrite * 1.25 + cacheRead * 0.1
}
```

成本估算若直接用 `input_tokens` 會嚴重低估——Anthropic 的 `input_tokens` 只含**未命中**的部分。

---

## 4. 路由層

### 4.1 model 名稱 → provider 解析

```ts
// 明確前綴優先：'groq:llama-x' → provider=groq, model=llama-x
function splitProviderPrefix(model: string): { provider?: ProviderId; model: string }

// 無前綴時從名稱推斷
export function providerFromModel(model: string): ProviderId {
  const m = model.toLowerCase()
  if (m.startsWith('@cf/'))    return 'cloudflare'
  if (m.startsWith('claude'))  return 'anthropic'
  if (m.startsWith('gemini') || m.startsWith('text-embedding-00')) return 'google'
  if (/gpt-oss|llama|qwen|mixtral/.test(m)) return 'groq'   // 必須在 '/' 判斷之前
  if (m.includes('/'))         return 'openrouter'
  if (/^(gpt|o1|o3|o4)/.test(m)) return 'openai'
  return 'anthropic'
}
```

**建議一律使用明確前綴。** 自動推斷是給舊資料的相容路徑，新 seed 資料全部寫 `provider:model`。

### 4.2 值得換模型的錯誤

```ts
export function isQuotaOrTransientError(e: unknown): boolean {
  const s = String((e as Error)?.message ?? e).toLowerCase()
  return /\b(401|402|403|404|429|500|502|503|529)\b/.test(s)
    || /(quota|rate.?limit|overloaded|insufficient|exceeded|payment|credit|too many requests|capacity|unavailable|timeout|aborted|not.?found|no longer available|does not exist|deprecated|decommission|authentication|unauthorized|invalid.?(api.?)?key|invalid token|forbidden)/.test(s)
}
```

涵蓋的情境與理由：
- `429 / quota / exceeded` — 免費額度用完。**這是免費優先策略最常見的路徑，必須無感切換。**
- `404 / not found / deprecated` — 模型被下架。免費 provider 換模型很頻繁。
- `401 / invalid key` — 某家金鑰失效。不能讓一把壞金鑰弄死整個功能。
- `5xx / overloaded / timeout` — 暫時性。

**不在此列的錯誤（如 prompt 格式錯誤、內容政策拒絕）必須直接拋出**，不可靜默換模型重試——那會把一個 bug 變成 N 倍的無效呼叫。

### 4.3 Circuit breaker

純記憶體、per-instance、best-effort、重啟即清空。

```ts
const CB_COOLDOWN_MS   = 60_000  // 跳閘冷卻
const CB_TRIP_THRESHOLD = 2      // 連續失敗 2 次跳閘

export function isProviderTripped(provider: string): boolean
function markProviderFailure(provider: string): void
function markProviderSuccess(provider: string): void   // 成功即清空計數
```

跳閘中的 provider **降到候選鏈隊尾而非移除**——仍保留為最後手段。這點很重要：如果所有免費 provider 同時跳閘，我們寧可等一個慢的，也不要無謂地升級到付費。

### 4.4 低信心偵測 → 升級

這是「免費優先」能成立的關鍵安全網。免費模型答不好時自動用付費模型再試一次。

```ts
const REFUSAL_PATTERNS = [
  /抱歉[，,\s]*我(?:無法|不能|沒有辦法)/,
  /我(?:無法|不能|沒辦法)(?:回答|協助|幫助|提供)/,
  /as an ai\b/i,
  /i(?:'m| am) (?:sorry|unable)\b/i,
  /i can(?:'t|not)\b/i,
  /無法回答|無可奉告|超出.*範圍/,
]

export function looksLowConfidence(text: string, minChars = 12): boolean {
  const t = (text ?? '').trim()
  if (!t) return true
  if (t.replace(/\s+/g, '').length < minChars) return true
  return REFUSAL_PATTERNS.some(re => re.test(t))
}
```

**升級規則**
1. 只在當前候選的 `role !== 'escalate'` 時觸發。
2. 只升級**一次**，不遞迴。
3. 升級目標：`role === 'escalate'` 的候選；沒有的話用鏈尾。
4. 升級結果若仍低信心 **且** 原輸出非空 → 保留原輸出（避免用付費模型換來一樣爛的答案還多付錢）。
5. 升級失敗（拋錯）不致命，沿用原輸出。
6. 每次升級寫入 `ai_usage_log.escalated = true`，供後續分析「哪些用途的免費模型其實不夠用」。

**結構化輸出的額外規則：** 若 `responseSchema` 存在且免費模型回傳的 JSON 無法通過 schema 驗證，**視同低信心**，觸發升級。這比字數啟發式可靠得多，凡是有 schema 的用途都應優先靠這條。

### 4.5 主流程

```ts
export async function completeForUsage(
  usageKey: AiUsageKey,
  opts: {
    spaceId: string
    system?: string
    user: string | AIMessage[]
    maxTokens?: number
    temperature?: number
    tools?: ToolDefinition[]
    responseSchema?: object
    forceEscalate?: boolean   // 使用者主動要求深入分析
  },
): Promise<UsageCompletion>

export type UsageCompletion = {
  text: string
  toolCalls?: ToolCall[]
  model: string
  provider: ProviderId
  isFree: boolean
  fellBack: boolean
  escalated: boolean
  attempts: number
  degraded: boolean        // 付費預算用盡而被迫降級 → UI 顯示「快速模式」
}
```

執行順序：

```
1. 預算閘門 —— 檢查 space 的付費額度（ADR-021）
      付費額度已用盡 → 從候選鏈濾掉所有付費候選，degraded = true
      免費額度已用盡 → 直接拋 QuotaExceededError（UI 顯示明日重置）

2. 快取查詢 —— 僅限單輪、無歷史的請求（見 §5）
      命中 → 直接回傳，attempts = 0

3. 取候選鏈 —— getCandidatesForUsage(usageKey)
      forceEscalate = true → 把 escalate 候選提到最前面

4. 排序 —— 跳閘中的 provider 降到隊尾

5. 依序嘗試
      缺 key → 跳過（不算 attempt）
      成功 → markProviderSuccess，進 6
      isQuotaOrTransient → markProviderFailure，換下一個
      其他錯誤 → 直接拋

6. 低信心檢查 → 升級一次（§4.4）

7. 候選全滅 → 撈任何 active 模型當保底
      仍失敗 → 拋 AllCandidatesFailedError

8. 寫 ai_usage_log + 寫快取（若可快取）
```

---

## 5. 回應快取

移植自 `ai-cache.ts`。對本產品特別有價值的是 `daily_card`、`greeting`、`daily_prompt`——這些在同一天內對不同 space 的輸入高度相似。

### 5.1 鐵則

1. **任何快取失敗都 fail-soft**，絕不影響主流程。
2. **只有單輪、無對話歷史的請求才走快取。** 多輪對話一律不查不寫。
3. **快取 key 必須包含所有會影響輸出的變數**，否則會回錯內容給錯的人。

### 5.2 兩層

**精確快取** — `sha256(normalized_prompt)` + 情境欄位全等
```ts
export function normalizeQuestion(text: string): string {
  let s = text.trim()
  s = s.replace(/　/g, ' ')       // 全形空白
  s = s.replace(/\s+/g, ' ')          // 連續空白
  s = s.toLowerCase()
  s = s.replace(/[？?。!！～~…\s]+$/u, '')  // 結尾標點
  return s
}
```

**語意快取** — pgvector cosine 相似度 ≥ **0.93**
門檻不可調低。0.93 以下會開始回答「意思相近但答案該不同」的問題。

### 5.3 不可快取的用途

`agent_chat`、`agent_chat_deep`、`memory_proposal`、`design_vision_*`、`insight_phrasing`、`weekly_recap`。

理由：這些的輸出必須反映該 space 的獨特脈絡。跨 space 快取會造成**資料外洩**——把 A 的作品分析回給 B。這是隱私事故，不是效能問題。

`ai_response_cache` 表因此有 `scope` 欄位：`global`（可跨 space）或 `space`（僅該 space）。預設 `space`，只有明確標記為 `global` 的用途（`daily_prompt`、`greeting` 的無個人化版本）才跨 space 共用。

---

## 6. 資料表

```sql
-- 可用模型清單（後台維護）
create table ai_models (
  id                  uuid primary key default gen_random_uuid(),
  provider            text not null,
  model_name          text not null,
  display_name        text not null,
  description         text,
  context_window      integer,
  cost_input_per_1m   numeric(10,4) not null default 0,   -- 免費模型填 0
  cost_output_per_1m  numeric(10,4) not null default 0,
  is_free             boolean not null default false,
  supports_vision     boolean not null default false,
  supports_tools      boolean not null default false,
  supports_streaming  boolean not null default true,
  is_active           boolean not null default true,
  sort_order          integer not null default 0,
  notes               text,        -- 例如「免費額度 1M/日」「2026-07-30 退役」
  metadata            jsonb not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (provider, model_name)
);

-- Provider 金鑰（加密）
create table ai_provider_keys (
  id                    uuid primary key default gen_random_uuid(),
  provider              text not null unique,
  api_key_encrypted     text not null,
  monthly_budget_usd    numeric(10,2),      -- null = 無上限（免費 provider）
  used_this_month_usd   numeric(10,4) not null default 0,
  budget_reset_at       date not null,
  enabled               boolean not null default true,
  last_ok_at            timestamptz,
  last_error            text,
  updated_at            timestamptz not null default now()
);

-- 用途 → 候選鏈
create table ai_usage_models (
  usage_key    text primary key,
  model_name   text not null,          -- 單一模型（向後相容）
  candidates   jsonb not null default '[]',  -- [{model, role}] 有序
  enabled      boolean not null default true,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users(id)
);

-- 每次呼叫的用量（成本歸因的唯一真相）
create table ai_usage_log (
  id                 uuid primary key default gen_random_uuid(),
  space_id           uuid references spaces(id) on delete cascade,
  usage_key          text not null,
  provider           text not null,
  model              text not null,
  is_free            boolean not null,
  fell_back          boolean not null default false,
  escalated          boolean not null default false,
  degraded           boolean not null default false,
  cache_hit          text,             -- null | 'exact' | 'semantic'
  attempts           integer not null default 1,
  tokens_input       integer not null default 0,
  tokens_output      integer not null default 0,
  cache_write_tokens integer not null default 0,
  cache_read_tokens  integer not null default 0,
  cost_usd           numeric(12,8) not null default 0,
  latency_ms         integer,
  error              text,
  created_at         timestamptz not null default now()
);

create index on ai_usage_log (space_id, created_at desc);
create index on ai_usage_log (usage_key, created_at desc);
create index on ai_usage_log (created_at desc) where is_free = false;

-- 每日額度（免費/付費分開）
create table ai_daily_quota (
  space_id    uuid not null references spaces(id) on delete cascade,
  local_date  date not null,
  free_calls  integer not null default 0,
  paid_calls  integer not null default 0,
  vision_calls integer not null default 0,
  primary key (space_id, local_date)
);

-- 回應快取
create table ai_response_cache (
  id            uuid primary key default gen_random_uuid(),
  usage_key     text not null,
  scope         text not null default 'space',   -- 'space' | 'global'
  space_id      uuid references spaces(id) on delete cascade,
  prompt_hash   text not null,
  context_hash  text not null,      -- 影響輸出的所有情境欄位的 hash
  embedding     vector(768),
  response_text text not null,
  hit_count     integer not null default 0,
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now()
);

create unique index on ai_response_cache (usage_key, scope, coalesce(space_id, '00000000-0000-0000-0000-000000000000'::uuid), prompt_hash, context_hash);
create index on ai_response_cache using ivfflat (embedding vector_cosine_ops);

-- 約束：scope='space' 必須有 space_id；scope='global' 必須沒有
alter table ai_response_cache add constraint cache_scope_check check (
  (scope = 'space'  and space_id is not null) or
  (scope = 'global' and space_id is null)
);
```

**RLS**
- `ai_models` / `ai_usage_models` / `ai_provider_keys`：**僅 service role 可讀寫**。一般使用者完全不可見（金鑰表尤其）。
- `ai_usage_log` / `ai_daily_quota`：space member 可讀自己 space 的（讓使用者看得到自己的用量），僅 service role 可寫。
- `ai_response_cache`：僅 service role。

---

## 7. 金鑰管理

```ts
// packages/ai-core/src/keys.ts
export async function getProviderKey(provider: ProviderId): Promise<string | null>
```

規則：
1. 優先讀 `ai_provider_keys`（DB，AES-256-GCM 加密，主金鑰在 `AI_KEY_ENCRYPTION_SECRET`）。
2. DB 沒有 → 退回環境變數 `{PROVIDER}_API_KEY`。
3. 都沒有 → 回 `null`，**路由層跳過該候選繼續走**，不拋錯。

第 3 點讓「只設了 Groq 跟 Gemini 兩把免費金鑰」也能完整運作——沒設的候選自動略過。開發者本機只需兩把免費金鑰即可跑起整個產品。

**絕不可** 把任何金鑰傳給前端，或寫進 log、error message、Sentry event。

---

## 8. 複雜度路由（可選層）

移植自 `ai-router.ts`，但本產品**預設不啟用**。

理由：AI 島用它是因為所有問題都走同一個 usage key（`ai_tutor`），需要在執行時判斷複雜度。本產品已經用 usage key 做了靜態分流（`agent_chat` vs `agent_chat_deep`），大部分情況更準確也更可預測。

**啟用時機：** 當 `ai_usage_log` 顯示 `agent_chat` 的 escalate 率持續超過 30%，代表靜態分流不夠細，此時再啟用動態評分。

```ts
export type ModelTier = 'cheap' | 'mid' | 'pro'

export function routeComplexity(input: {
  question: string
  isFirstMessage: boolean
  hasSelectedDesign: boolean
  hasImage: boolean
}): { tier: ModelTier; score: number; reasons: string[] }
```

關鍵字表要換成設計/創作領域（原版是程式教學領域）：

```ts
const PRO_KEYWORDS = [
  '為什麼', '為何', '評論', '分析', '比較', '差異', '建議',
  '改進', 'problem', '哪裡不好', '層級', '視覺動線', '排版',
  '配色原理', '對比', '易讀性', '風格', '調性', '重新設計',
]
const MID_KEYWORDS = [
  '怎麼做', '如何', '教我', '範例', '幫我', '產生', '生成',
  '搭配', '推薦',
]
const CHEAP_KEYWORDS = [
  '是什麼', '什麼是', '列出', '幾個', '翻譯', '改名', 'tag',
]
```

`hasImage = true` 一律至少 `mid`（純文字模型處理不了）。

---

## 9. 給呼叫端的規則

### ✅ 正確

```ts
import { completeForUsage } from '@snowrealm/ai-core'

const result = await completeForUsage('daily_card', {
  spaceId,
  system: DAILY_CARD_SYSTEM,
  user: buildDailyCardPrompt(context),
  responseSchema: DAILY_CARD_SCHEMA,
  maxTokens: 300,
})
```

### ❌ 禁止

```ts
import Anthropic from '@anthropic-ai/sdk'        // 禁止在 feature code
const client = new Anthropic({ apiKey: ... })     // 禁止
await fetch('https://api.openai.com/...')         // 禁止
completeForUsage('agent_chat', { model: 'claude-...' })  // 禁止指定模型
```

**ESLint 規則強制執行**（見 `11-engineering-setup.md`）：
```js
'no-restricted-imports': ['error', {
  paths: [
    { name: '@anthropic-ai/sdk', message: '請用 @snowrealm/ai-core 的 completeForUsage()' },
    { name: 'openai',            message: '請用 @snowrealm/ai-core 的 completeForUsage()' },
    { name: '@google/generative-ai', message: '請用 @snowrealm/ai-core 的 completeForUsage()' },
  ],
}]
```
`packages/ai-core/**` 自身豁免。

---

## 10. UI 要求

免費優先策略必須對使用者誠實可見，否則會變成「偷偷降級」。

| 狀態 | UI 呈現 |
|---|---|
| 正常（免費模型） | 無特別標示。這是預設狀態，不需要打擾使用者 |
| 已升級（付費） | 訊息旁小標示「深入分析」 |
| `degraded = true` | 明確提示「本次使用快速模式（今日深入分析額度已用完，明日 00:00 重置）」 |
| 免費額度用盡 | 輸入框停用 + 說明 + 重置時間 |
| 所有候選失敗 | 「AI 暫時忙線，請稍後再試」+ **保留使用者輸入** + 重試按鈕 |

最後一項對應 v1.0 §46.2：保留輸入、可重試、不生成假結果。

**絕不可** 因為省成本而讓 Agent 產生比較差的答案卻假裝是正常品質。若免費模型明顯答不好，正確做法是升級（§4.4），不是端出爛答案。

---

## 11. 驗收條件

```gherkin
Feature: 多模型路由

  Scenario: 一般對話走免費模型
    Given space 的免費額度未用盡
    When 使用者送出一則一般訊息
    Then ai_usage_log 該筆的 is_free 為 true
    And cost_usd 為 0

  Scenario: 免費 provider 額度用盡時無感切換
    Given 候選鏈第一個 provider 回傳 429
    When 使用者送出訊息
    Then 系統自動使用第二個候選完成回應
    And 使用者看不到任何錯誤
    And ai_usage_log 的 fell_back 為 true

  Scenario: 免費模型低信心時升級
    Given 免費模型回傳空字串
    When 該用途有 escalate 候選
    Then 系統用 escalate 候選重試一次
    And ai_usage_log 的 escalated 為 true

  Scenario: 付費額度用盡時降級而非失敗
    Given space 今日付費呼叫已達 20 次
    When 使用者按下「深入分析」
    Then 系統使用免費 vision 模型完成分析
    And 回應的 degraded 為 true
    And UI 顯示「快速模式」提示

  Scenario: 真錯誤不觸發換模型
    Given prompt 含不合法內容導致 400
    When 呼叫 completeForUsage
    Then 系統直接拋出錯誤
    And attempts 為 1
    And 不得嘗試其他候選

  Scenario: 跨 space 快取隔離
    Given space A 對某作品做過分析
    When space B 送出字面完全相同的問題
    Then 系統不得回傳 space A 的快取結果

  Scenario: 缺金鑰的候選被跳過
    Given 候選鏈第一個 provider 沒有設定 api key
    When 呼叫 completeForUsage
    Then 系統直接使用第二個候選
    And attempts 不計入被跳過的候選

  Scenario: Circuit breaker 降序而非移除
    Given 某 provider 連續失敗 2 次而跳閘
    And 其他所有候選都缺金鑰
    When 呼叫 completeForUsage
    Then 系統仍嘗試該跳閘的 provider
```

---

## 12. 移植檢查清單

從 `ai_island_v3` 移植時逐項確認：

- [ ] `stripLoneSurrogates` 套用在**所有**送出的文字上（含 system、user、tool result）
- [ ] Anthropic `PROMPT_CACHE_MARKER` 切分邏輯保留
- [ ] `billableInputTokens` 用於成本估算，不直接用 `input_tokens`
- [ ] `isQuotaOrTransientError` 的正則完整照搬，不精簡
- [ ] Circuit breaker 的「降到隊尾」而非「移除」語意保留
- [ ] `looksLowConfidence` 的拒答模式表照搬，並補上 schema 驗證失敗
- [ ] 升級只做一次、不遞迴
- [ ] 升級結果較差時保留原輸出
- [ ] `noFallback` 旗標保留（避免 `callAI` 與 `completeForUsage` 雙重退避）
- [ ] 快取只用於單輪請求
- [ ] **新增：** 快取的 `scope` 隔離（AI 島無多租戶，這是本產品必須新增的）
- [ ] **新增：** 每次呼叫前的 space 預算閘門
- [ ] **新增：** `degraded` 旗標與對應 UI
- [ ] **新增：** tool calling 支援（AI 島的 provider 層未涵蓋）
