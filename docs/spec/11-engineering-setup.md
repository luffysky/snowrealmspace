# 工程環境設定

> v1.0 §53 給了 repo 結構但沒說用什麼工具、Node 版本、環境變數、CI 或測試設定。本檔補齊，讓「clone 後能跑起來」成為可執行的步驟。

---

## 1. Repository 結構

```
snowrealm-space/
├── apps/
│   ├── web/                    Next.js App Router
│   │   ├── app/
│   │   │   ├── (auth)/         登入、邀請驗證
│   │   │   ├── (space)/        需登入的主應用
│   │   │   │   ├── home/
│   │   │   │   ├── studio/     theme / background / layout
│   │   │   │   ├── design/     Design Hub
│   │   │   │   ├── library/
│   │   │   │   ├── timeline/
│   │   │   │   ├── agent/
│   │   │   │   └── settings/
│   │   │   └── api/
│   │   ├── features/           依功能分組的 UI + hooks
│   │   ├── components/         跨功能共用元件
│   │   ├── lib/
│   │   └── styles/
│   └── worker/                 pg-boss worker（長駐）
│       └── src/handlers/
├── packages/
│   ├── ui/                     無業務邏輯的元件
│   ├── theme-engine/           token 編譯、對比、取色
│   ├── font-engine/            分片、載入
│   ├── widget-engine/          registry、格線、碰撞
│   ├── ai-core/                多模型路由（12-ai-model-routing.md）
│   ├── agent-core/             context builder、tools、五分類
│   ├── memory-core/
│   ├── design-adapters/        Provider adapter
│   ├── storage/                StorageAdapter（R2）
│   ├── analytics/              事件、投影
│   ├── shared-types/
│   └── validation/             zod schema（前後端共用）
├── supabase/
│   ├── migrations/
│   ├── seed/
│   └── tests/                  RLS 測試
├── prompts/
├── content/                    Daily / Surprise 內容池
├── scripts/
├── docs/
│   ├── SnowRealm-Space-Full-Spec-v1.0.md   產品憲章
│   └── spec/                                本目錄
├── e2e/
├── .env.example
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

**分層規則：**
- `packages/*` 不得 import `apps/*`
- `packages/ui` 不得 import 任何其他 `packages/*`（純展示）
- `apps/web/features/*` 之間不得互相 import；共用邏輯上提到 `packages/`
- 由 `dependency-cruiser` 在 CI 檢查

---

## 2. 版本與工具

```
Node       22 LTS      （.nvmrc + package.json engines）
pnpm       9.x         （packageManager 欄位鎖定）
TypeScript 5.6+
Next.js    15
React      19
Postgres   15          （Supabase）
```

```json
// package.json
{
  "packageManager": "pnpm@9.12.0",
  "engines": { "node": ">=22.0.0 <23", "pnpm": ">=9" }
}
```

### TypeScript

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "moduleResolution": "bundler",
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"]
  }
}
```

`noUncheckedIndexedAccess` 會讓 `arr[0]` 的型別是 `T | undefined`。它很煩，但這個產品有大量陣列索引（格線、候選鏈、內容池），開著能擋掉整類 runtime error。

---

## 3. 環境變數

```bash
# .env.example

# ── App ──────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development

# ── Supabase ─────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # 僅伺服器端，絕不可有 NEXT_PUBLIC_ 前綴
DATABASE_URL=                        # worker 與 migration 用

# ── Cloudflare R2 ────────────────────────────
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=snowrealm-dev
R2_PUBLIC_BASE_URL=                  # 若有自訂網域

# ── 加密 ─────────────────────────────────────
AI_KEY_ENCRYPTION_SECRET=            # 32 bytes base64，加密 ai_provider_keys
TOKEN_ENCRYPTION_SECRET=             # 32 bytes base64，加密 OAuth token
CRON_SECRET=                         # cron 端點驗證

# ── AI Provider（ADR-023：至少設兩把免費金鑰即可開發）──
# 免費層 —— 建議至少設 GROQ + GOOGLE
GROQ_API_KEY=
GOOGLE_AI_API_KEY=
CEREBRAS_API_KEY=
MISTRAL_API_KEY=
SAMBANOVA_API_KEY=
NVIDIA_API_KEY=
OPENROUTER_API_KEY=
CLOUDFLARE_ACCOUNT_ID=               # Workers AI 用
CLOUDFLARE_AI_TOKEN=

# 付費層 —— 只在升級路徑使用，開發時可留空
ANTHROPIC_API_KEY=

# ── Provider OAuth（Milestone F 才需要）────────
FIGMA_CLIENT_ID=
FIGMA_CLIENT_SECRET=
FIGMA_WEBHOOK_SECRET=
```

### 驗證

```ts
// packages/shared-types/src/env.ts —— 啟動時驗證，缺必要變數直接崩潰
export const env = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DATABASE_URL: z.string().url(),
  R2_ACCOUNT_ID: z.string().min(1),
  AI_KEY_ENCRYPTION_SECRET: z.string().length(44),   // 32 bytes base64
  CRON_SECRET: z.string().min(32),
  // AI 金鑰全部 optional —— 路由層會跳過沒金鑰的候選
  GROQ_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  // ...
}).parse(process.env)
```

**啟動時就崩潰勝過執行到一半才發現。** 缺 `CRON_SECRET` 應該在 `pnpm dev` 的第一秒就報錯，而不是三天後某個 cron 靜默失敗。

### 安全規則
- `SUPABASE_SERVICE_ROLE_KEY` 出現在任何 `NEXT_PUBLIC_*` 或 client component → CI 失敗
- 所有 `*_SECRET` / `*_KEY` 禁止出現在 log、error message、Sentry breadcrumb
- production 的 secret 存 Vercel Environment Variables 與 Railway secrets，不進 repo

---

## 4. 本機啟動

```bash
# 1. 前置
node -v            # 需 22.x
corepack enable

# 2. 安裝
pnpm install

# 3. 環境變數
cp .env.example .env.local
# 最少需要填：Supabase 三項、DATABASE_URL、R2 四項、三組 SECRET、
#             以及至少一把免費 AI 金鑰（建議 GROQ_API_KEY）

# 4. 產生加密金鑰
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 5. 資料庫
pnpm db:migrate
pnpm db:seed          # 字體、widget 定義、feature flag、內容池

# 6. 啟動
pnpm dev              # web + worker 並行
```

**「最少需要填」清單是刻意的。** 一個新加入的開發者不該為了看到首頁而去申請 9 家 AI provider 的帳號。

---

## 5. Scripts

```json
{
  "scripts": {
    "dev":        "turbo run dev --parallel",
    "build":      "turbo run build",
    "lint":       "turbo run lint",
    "typecheck":  "turbo run typecheck",
    "test":       "turbo run test",
    "test:rls":   "vitest run supabase/tests",
    "test:e2e":   "playwright test",
    "test:a11y":  "playwright test --grep @a11y",
    "db:migrate": "supabase migration up",
    "db:reset":   "supabase db reset",
    "db:seed":    "tsx scripts/seed.ts",
    "fonts:build":"tsx scripts/build-fonts.ts",
    "content:seed":"tsx scripts/seed-content.ts",
    "check:rls":  "tsx scripts/check-rls.ts",
    "check:deps": "depcruise --config .dependency-cruiser.js packages apps",
    "check:secrets": "tsx scripts/check-secrets.ts"
  }
}
```

---

## 6. Lint 規則

除標準 `@typescript-eslint` 外，以下是本專案特有且**不可關閉**的：

```js
// eslint.config.js
rules: {
  // ADR-023：禁止直接呼叫 AI 廠商
  'no-restricted-imports': ['error', { paths: [
    { name: '@anthropic-ai/sdk',      message: '請用 @snowrealm/ai-core 的 completeForUsage()' },
    { name: 'openai',                 message: '同上' },
    { name: '@google/generative-ai',  message: '同上' },
    { name: '@aws-sdk/client-s3',     message: '請用 @snowrealm/storage 的 StorageAdapter' },
  ]}],

  // 05-theme-tokens.md §7：禁止字面顏色
  'no-restricted-syntax': ['error',
    { selector: "Literal[value=/^#[0-9a-fA-F]{3,8}$/]", message: '請使用 --sr-* token' },
    { selector: "Literal[value=/^rgba?\\(/]",           message: '請使用 --sr-* token' },
  ],

  // ADR-006：禁止以 created_by 做授權
  'no-restricted-properties': ['error',
    { property: 'owner_id', message: '授權一律用 space_id（ADR-006）' },
  ],
}
```

豁免路徑寫在各自的 override 區塊：`packages/ai-core/**`、`packages/storage/**`、`packages/theme-engine/**`、`*.stories.tsx`、`supabase/seed/**`。

### 自訂檢查腳本

| 腳本 | 檢查 |
|---|---|
| `check:rls` | 每張帶 `space_id` 的表都有 policy（`03-database.md` §15 的查詢） |
| `check:secrets` | service role key 未洩漏到 client bundle |
| `check:deps` | 分層規則（§1） |

三者皆在 CI 執行，任一失敗則 build 失敗。

---

## 7. 測試

### 設定

```ts
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      thresholds: {
        'packages/theme-engine/**':  { lines: 95, functions: 95 },
        'packages/widget-engine/**': { lines: 95, functions: 95 },
        'packages/ai-core/**':       { lines: 85, functions: 85 },
        'packages/**':               { lines: 80, functions: 80 },
      },
    },
  },
})
```

`theme-engine` 與 `widget-engine` 門檻拉到 95%：它們是純函式且是視覺正確性的基礎，測試成本低而回報高。

### RLS 測試（ADR-017，不可協商）

```ts
// supabase/tests/rls.test.ts —— 對真實 Postgres 執行
describe.each(TABLES_WITH_SPACE_ID)('RLS: %s', (table) => {
  it('成員可讀自己 space 的資料', async () => { ... })
  it('space B 的使用者讀不到 space A 的資料', async () => {
    const { data } = await clientB.from(table).select('*')
    expect(data).toHaveLength(0)         // ← 不是 error，是空陣列
  })
  it('未登入者讀不到任何資料', async () => { ... })
})

describe('RLS: 敏感表', () => {
  it.each(['memories','design_connections'])('collaborator 讀不到 %s', ...)
})
```

`TABLES_WITH_SPACE_ID` 從 `information_schema` 動態產生 —— **新增表時測試自動涵蓋**，不會因為忘記加測試而漏掉。

### Provider mock

```ts
// 禁止手寫理想化的 mock
// ✅ 用錄製的真實回應
import figmaFileResponse from './fixtures/figma-file-response.json'
```

理由：手寫 mock 只會涵蓋開發者想像中的回應。真實 API 的邊界情況（缺欄位、null、意外的巢狀結構）只有錄製才抓得到。

### E2E

`e2e/` 涵蓋 v1.0 §45.2 的 14 條流程。每條加上 `@a11y` 標籤的變體，用 axe-core 檢查。

---

## 8. CI

```yaml
# .github/workflows/ci.yml
jobs:
  quality:
    steps:
      - pnpm install --frozen-lockfile
      - pnpm lint
      - pnpm typecheck
      - pnpm check:deps
      - pnpm check:secrets

  test:
    services:
      postgres: { image: pgvector/pgvector:pg15 }
    steps:
      - pnpm db:migrate
      - pnpm check:rls        # ← 缺 policy 的表會讓這裡失敗
      - pnpm test
      - pnpm test:rls

  e2e:
    steps:
      - pnpm build
      - pnpm test:e2e
      - pnpm test:a11y

  content:
    steps:
      - pnpm content:seed --dry-run   # 內容數量不足則失敗（09-content-pool.md §10）
```

四個 job 全綠才可 merge。

---

## 9. Git

```yaml
# lefthook.yml
pre-commit:
  commands:
    format: { glob: "*.{ts,tsx,css,md}", run: "pnpm prettier --write {staged_files}" }
    lint:   { glob: "*.{ts,tsx}",        run: "pnpm eslint --fix {staged_files}" }
pre-push:
  commands:
    typecheck: { run: "pnpm typecheck" }
```

Commit 格式：`<type>(<scope>): <subject>`，type 為 `feat|fix|refactor|test|docs|chore|perf`，scope 為套件或 feature 名。

分支：`main`（受保護）+ `feat/*` / `fix/*`。

---

## 10. 部署（ADR-008）

| 元件 | 平台 | 備註 |
|---|---|---|
| `apps/web` | Vercel | 自動部署，preview per PR |
| `apps/worker` | Railway 或 Fly.io | 長駐；影片轉碼與 Vision 分析超過 serverless 上限 |
| DB / Auth | Supabase | preview 與 production **不同 project** |
| 儲存 | Cloudflare R2 | preview 與 production **不同 bucket** |

### Migration 流程
1. 本機寫 migration → `pnpm db:reset` 驗證可重跑
2. PR 觸發 preview 環境自動 migrate
3. merge 後手動觸發 production migrate（**不自動**）
4. 破壞性變更必須分兩次部署：先加欄位相容，再移除舊欄位

第 3 點刻意不自動化：資料庫變更是少數「回滾成本遠高於部署成本」的操作。

### Preview 環境限制
- 使用獨立的 Supabase project 與 R2 bucket
- AI 金鑰只設免費層，**不設 `ANTHROPIC_API_KEY`** → preview 環境自動全走免費模型，PR 不會產生帳單
- Cron 停用

---

## 11. 監控

| 項目 | 手段 |
|---|---|
| 錯誤 | Sentry（web + worker），PII 過濾開啟 |
| AI 成本 | `ai_usage_log` 每日彙總 + 超過閾值告警 |
| Queue | `/api/cron/queue-health` |
| RLS 違規 | Postgres log 中的 policy 拒絕，異常增加時告警 |
| 效能 | Vercel Analytics（Core Web Vitals） |

`/api/health` 回傳 DB、R2、queue 三者的連線狀態，供 uptime 監控使用。

---

## 12. 新開發者上手檢查

```
[ ] pnpm install 成功
[ ] .env.local 填入最少必要變數
[ ] pnpm db:migrate 成功
[ ] pnpm db:seed 成功
[ ] pnpm dev 啟動且 localhost:3000 顯示登入頁
[ ] pnpm test 全綠
[ ] 用 scripts/create-invite.ts 產生邀請並完成登入
[ ] 上傳一張圖並看到縮圖
[ ] 只設一把免費 AI 金鑰即可與 Agent 對話
```

最後一項是這套設定是否成功的判準：**新人不該為了跑起專案而去申請付費 API。**
