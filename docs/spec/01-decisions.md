# ADR — 架構決策紀錄

> 本檔是 SnowRealm Space 的決策真相來源。
> v1.0 憲章 §57「尚待決策事項」的 20 項，在此全部收斂為 Accepted 或 Deferred。
> 任何與本檔衝突的敘述，以本檔為準。

## 狀態定義

| 狀態 | 意義 |
|---|---|
| `Accepted` | 已由專案負責人拍板，實作必須遵守 |
| `Proposed` | 由規格作者代為決定的合理預設；未被推翻前視同 Accepted |
| `Deferred` | 明確延後；已確認不阻塞 Birthday Alpha，且延後不會造成重構 |
| `Superseded` | 被後續 ADR 取代 |

---

## ADR-001 交付節奏：Milestone 閉環優先，無硬期限

**狀態：** Accepted

**決策**
不設生日硬期限。依 Milestone A→F 順序推進，每個 Milestone 結束時必須存在一個**使用者可獨立完成的閉環**，而非半成品堆疊。

**閉環定義**
一個 Milestone 通過的條件是：一位不知道實作細節的人，能在不看文件的情況下，用 UI 完成該 Milestone 宣稱的事，並在重新整理後看到結果被保留。

**影響**
- v1.0 §48.1 的 22 項 Must Have 不再是「同時交付」，而是分配到 Milestone B–E。
- 每個 Milestone 有獨立的 Definition of Done（見 `10-acceptance.md`）。
- 未達閉環的 Milestone 不得開始下一個 Milestone。

**替代方案（已否決）**
以生日日期倒推砍範圍。否決理由：使用者明確選擇無硬期限，倒推會犧牲 §5.6「功能必須形成閉環」原則。

---

## ADR-002 技術棧：Next.js + Supabase + Cloudflare R2

**狀態：** Accepted

**決策**

| 層 | 選型 | 版本下限 |
|---|---|---|
| Runtime | Node.js | 22 LTS |
| Web Framework | Next.js（App Router） | 15 |
| UI | React + TypeScript（strict） | 19 / 5.6 |
| Auth | Supabase Auth | — |
| DB | Supabase PostgreSQL | 15 |
| 授權 | Postgres Row Level Security | — |
| 物件儲存 | Cloudflare R2（S3 相容 API） | — |
| Queue | pg-boss（跑在同一個 Postgres） | 10 |
| Cron | Vercel Cron → 內部 HTTP 端點 | — |
| 部署（web） | Vercel | — |
| LLM / Vision | Anthropic Claude | — |
| 向量 | pgvector | 0.7 |

**理由**
- 已有 Postgres，Queue 用 pg-boss 可避免引入第四個服務商與第四組帳單/金鑰。事務性入列（job 與資料變更同一個 transaction）是這個產品的關鍵需求：例如「建立 snapshot」與「排入分析 job」必須同生同死。
- R2 相對 Supabase Storage 的優勢是零 egress 費用，這對「背景幻燈片 + 縮圖 + 影片」這種讀取密集的產品是實質差異。代價是要自己實作 signed URL 與清理，已納入 `03-database.md` 與 `08-jobs-events.md`。

**影響**
- 需要三組服務商帳號與金鑰：Supabase、Cloudflare、Anthropic、Vercel（四組）。完整環境變數清單見 `11-engineering-setup.md`。
- 儲存層必須走 `StorageAdapter` 介面，不得在 feature code 直接呼叫 S3 SDK。

---

## ADR-003 Auth：Supabase Magic Link + 多租戶 RLS 從第一天

**狀態：** Accepted

**決策**
- 登入方式：Supabase Auth email magic link。Birthday Alpha 不做密碼、不做 OAuth 社群登入。
- 所有使用者資料表從第一次 migration 就帶 `space_id` 並啟用 RLS。
- Birthday Alpha 只會有一個 space、一位 owner，但**程式碼與 schema 皆不得假設 space 數量為 1**。
- 邀請制：以 `space_invites` 表控制誰能建立/加入 space。Alpha 期間 sign-up 預設關閉，只有持有有效 invite token 的 email 能完成註冊。

**理由**
使用者明確選擇「多租戶 schema 現在就做」。RLS 補寫的成本遠高於一開始就寫：補寫時必須回頭審查每一條既有 query 是否曾依賴無限制存取。

**影響**
- v1.0 §2「不可把 Nami 的名稱、偏好與資料寫死」由 schema 層強制執行，不靠自律。
- 每張新表的 migration 必須同時包含 RLS policy，否則 CI 失敗（見 `11-engineering-setup.md` 的 lint 規則）。
- 解除 v1.0 §57.8 與 §57.9 未決狀態。

**反例（禁止）**
```ts
// 禁止：以 auth.uid() 直接當作資料邊界
const themes = await db.from('themes').select().eq('created_by', user.id)
// 正確：以 space_id 為邊界，RLS 負責過濾
const themes = await db.from('themes').select().eq('space_id', spaceId)
```

---

## ADR-004 AI Provider：Anthropic Claude（LLM + Vision）

**狀態：** ~~Accepted~~ **Superseded by ADR-023**

原決策為單一 provider（Claude）。專案負責人後續指示：**多模型接入、免費優先、必要才用高級模型、一般聊天用免費**，並以 `D:\SnowRealmRebirth\AI\ai_island_v3` 的既有實作為參考。

保留的部分：
- 仍必須走 `LLMProvider` / `VisionProvider` 抽象層，feature code 不得直接 import 任何廠商 SDK。
- 仍解除 v1.0 §57.11 / §57.12 未決狀態（答案改為「多家，依用途與複雜度路由」）。

被取代的部分：單一 provider、單一金鑰、固定模型分配。詳見 ADR-023 與 `12-ai-model-routing.md`。

---

## ADR-023 多模型路由：免費優先、按需升級

**狀態：** Accepted

**決策**
採用 AI Island v3 已驗證的三層架構，移植到 SnowRealm Space 並改為**免費優先**策略：

```
用途 (usage key)
    ↓  ai_usage_models：每個用途有一條「有序候選鏈」
候選鏈 [free primary] → [free fallback] → [paid escalate]
    ↓  circuit breaker：剛失敗的 provider 降到隊尾
統一 provider 層 (OpenAI 相容 / Anthropic / Google 三種協定)
    ↓  額度用盡 / 429 / 5xx / 模型下架 → 自動換下一家
回應 + 用量寫入 ai_usage_log
```

**三條核心規則**

1. **一般 Agent 對話一律從免費模型起跳。** 只有在 (a) 使用者主動要求深度分析、(b) 需要 tool calling、(c) 免費模型輸出低信心（空/過短/像拒答）三種情況才升級到付費模型。
2. **本地演算法優先於任何 LLM。** ADR-012 不變：取色、對比、留白比例等可計算的東西永遠不送 AI。這是最大的一筆成本節省，也最符合 v1.0 §5.2 證據優先。
3. **付費模型的每一次呼叫都必須可歸因。** `ai_usage_log` 記錄 space_id、usage_key、實際使用的 provider/model、是否 fallback、是否 escalate、token 與成本估算。

**免費 provider 清單（皆免信用卡，全部 OpenAI 相容除另註）**

| Provider | 免費額度（撰稿時） | 協定 | Vision | 備註 |
|---|---|---|---|---|
| Google Gemini | Flash 系列有免費層 | Google 專用 | ✅ | 免費層中唯一視覺能力可靠者 |
| Groq | 免費層，速度極快 | OpenAI 相容 | 部分模型 | 延遲最低，適合即時對話 |
| Cerebras | ~1M tokens/日 | OpenAI 相容 | ❌ | 額度大，適合批次 |
| Mistral | Experiment 層 ~1B tokens/月 | OpenAI 相容 | ❌ | 額度最大 |
| SambaNova | 免費額度 | OpenAI 相容 | ❌ | 快 |
| NVIDIA NIM | 免費 | OpenAI 相容 | 部分模型 | — |
| OpenRouter | `:free` 後綴模型 | OpenAI 相容 | 視模型 | 聚合器，可當保底 |
| Cloudflare Workers AI | 免費額度 | OpenAI 相容 | 部分模型 | 需 account id |

**不採用 GitHub Models。** AI Island 程式碼註記其服務於 **2026-07-30 退役**（距今一週），接了就要拆。

> ⚠️ 上表額度會變動。**實際額度不寫死在程式碼或本文件**，而是存在 `ai_models` 表由後台維護；程式只依賴「這個候選失敗了就換下一個」的行為，不依賴任何額度數字。

**付費模型（僅在升級路徑）**

| 用途 | 升級目標 | 觸發條件 |
|---|---|---|
| Agent 對話 | Claude 主力模型 | 使用者按「深入分析」、需要 tool calling、或免費輸出低信心 |
| 設計深度分析 | Claude（Vision） | 使用者明確點擊「請 Agent 分析這張設計」 |
| 其他全部 | 不升級 | Daily Card、記憶提案、標題生成等一律只用免費層 |

**理由**
- 這個產品的高頻 AI 用途（Daily Card、問候語、記憶提案摘要、tag 建議）都是短輸入短輸出的低複雜度任務，免費模型完全勝任。把它們送去付費模型是純粹浪費。
- 低頻但高價值的用途（設計評論、有 tool calling 的對話）才值得付費模型。這剛好對應 v1.0 §7.4 的「作品分析」——那是使用者主動觸發、且期待品質的時刻。
- 多家 fallback 讓免費層的額度限制不再是單點故障：Cerebras 用完自動換 Mistral，全滅才退到付費。

**影響**
- ADR-021 的成本上限改為「付費呼叫上限」，免費呼叫另計較寬鬆的速率限制。
- 新增資料表：`ai_models`、`ai_provider_keys`、`ai_usage_models`、`ai_usage_log`、`ai_response_cache`。
- 實作細節、候選鏈預設值、tier 判定演算法見 `12-ai-model-routing.md`。

**移植來源對照**

| SnowRealm Space | AI Island v3 來源 | 改動 |
|---|---|---|
| `packages/ai-core/src/providers.ts` | `src/lib/ai-providers.ts` | 幾乎照搬；補 tool calling 與結構化輸出 |
| `packages/ai-core/src/router.ts` | `src/lib/ai-router.ts` | 關鍵字表換成設計/創作領域詞彙 |
| `packages/ai-core/src/resolve-usage.ts` | `src/lib/resolve-usage-ai.ts` | 照搬斷路器與升級邏輯；加 space 層級預算檢查 |
| `packages/ai-core/src/usage-models.ts` | `src/lib/ai-usage-models.ts` | usage key 換成本產品的 |
| `packages/ai-core/src/cache.ts` | `src/lib/ai-cache.ts` | 照搬精確 + 語意快取 |

---

## ADR-005 統一資產模型：`assets` 是二進位內容的唯一真相

**狀態：** Proposed

**問題**
v1.0 同時定義了 `assets`、`design_files`、`backgrounds` 三張表，且三者都有 `thumbnail_url`。上傳一張 PNG 後把它同時當作品、當背景、拿去生成主題時，資料該進哪張表沒有答案。這會導致同一個檔案被存三份、刪除時漏刪、縮圖重複生成。

**決策**
拆成「內容」與「用途」兩層：

```
assets            ← 唯一的二進位真相。任何進入系統的位元組都是一筆 asset。
  └ asset_renditions  ← 該 asset 的衍生檔（preview / thumbnail / 轉碼影片）

design_files      ← 「創作單元」的邏輯容器（一個上傳作品 / 一個 Figma file）。不存二進位。
  └ design_snapshots  ← design_file 在某時點的版本，指向 asset。

background_items  ← 「把某個 asset 當背景呈現」的設定，指向 asset。不存二進位。
```

**結果**
一張 PNG 上傳後：
1. 產生 1 筆 `assets`（+ 自動產生 preview / thumbnail 兩筆 `asset_renditions`）。
2. 若使用者標記為作品 → 產生 1 筆 `design_files(provider='upload')` + 1 筆 `design_snapshots` 指向該 asset。
3. 若使用者設為背景 → 產生 1 筆 `background_items` 指向**同一個** asset。

位元組只存一份，縮圖只生一次，刪除 asset 時可依 FK 找出所有引用並提示使用者。

**影響**
- v1.0 §34.1 表列中的 `backgrounds` 更名為 `background_items` 並改變語意。
- v1.0 §34.5 的 `backgrounds` DDL 作廢，以 `03-database.md` 為準。
- v1.0 §12.2 的 `BackgroundItem` type 移除 `sourceUrl` / `thumbnailUrl`，改為 `assetId`。
- v1.0 §34.1 的 `asset_versions` 移除：版本語意由 `design_snapshots` 承擔，`assets` 本身不可變（immutable）。

---

## ADR-006 `space_id` 是唯一租戶鍵

**狀態：** Proposed

**問題**
v1.0 中 `themes` 用 `space_id`、`design_files` 用 `owner_id`、`memories` 兩個都有。邊界不一致會讓 RLS policy 無法統一，且多使用者版本上線時必然爆炸。

**決策**
- 所有承載使用者內容的表**必須**有 `space_id uuid not null`，且它是唯一的授權邊界。
- `created_by uuid`（指向 `auth.users`）是**歸屬資訊**，用於顯示「誰做的」，**不是**授權欄位。
- 唯一例外：`design_connections`（OAuth token 綁 user 身分而非 space）仍同時帶 `space_id` 與 `user_id`，授權以 `space_id` 判定，token 使用以 `user_id` 稽核。

**統一 RLS pattern**
```sql
create policy "space members can read"
  on <table> for select
  using (space_id in (
    select space_id from space_members where user_id = auth.uid()
  ));
```

**影響**
所有 `03-database.md` 的 DDL 遵守此規則，無例外。

---

## ADR-007 Queue 與 Cron

**狀態：** Proposed

**決策**
- **Queue：** pg-boss，schema 為 `pgboss`，與應用資料同一個 Postgres 實例。
- **Worker：** 獨立的 Node process（`apps/worker`），部署為長駐服務。不使用 serverless function 跑 worker，因為影片轉碼與 Vision 分析會超過 serverless 時間上限。
- **Cron：** Vercel Cron 呼叫 `POST /api/cron/{job}`，以 `CRON_SECRET` header 驗證，端點本身只負責**入列**，不做實際工作。

**Cron 排程**

| 端點 | 頻率 | 工作 |
|---|---|---|
| `/api/cron/daily-generate` | 每小時 `0 * * * *` | 為時區剛跨過 04:00 的 space 生成當日 daily items |
| `/api/cron/token-refresh` | 每 15 分 | 刷新 60 分內到期的 provider token |
| `/api/cron/insight-weekly` | 每小時 | 為本地時間週一 09:00 的 space 生成週報 |
| `/api/cron/storage-gc` | 每日 03:00 UTC | 清理孤兒 asset 與過期上傳 |
| `/api/cron/queue-health` | 每 5 分 | 檢查 stuck job，超時的標記 failed 並告警 |

**每小時掃時區的理由**
使用者時區各異，「每天早上」不是全域時刻。每小時執行一次、只挑選當地時間剛好跨過門檻的 space，可以用單一排程服務所有時區，且天然冪等（見 `08-jobs-events.md` 的 `daily_items` unique constraint）。

---

## ADR-008 部署拓撲：Zeabur

**狀態：** Accepted（2026-07-23 由專案負責人指定）

原提案為 Vercel + Railway/Fly.io + Supabase Cloud 三家。改為 **Zeabur 單一平台**。

```
Zeabur（單一專案，共用內網）
  ├ apps/web            Next.js（SSR + API routes + Cron 端點）
  ├ apps/worker         pg-boss worker，長駐服務
  └ Supabase            Zeabur 的 Supabase 模板（Postgres + Auth + 內建服務）

Cloudflare
  └ R2                  private bucket，所有檔案

AI Provider（ADR-023）
  └ 免費層為主，Anthropic 僅在升級路徑
```

**改用 Zeabur 的理由**
- 一個平台同時跑 web、長駐 worker、Supabase。原方案要在三家各自設定金鑰、網路與部署流程。
- worker 是長駐服務（ADR-002：影片轉碼與 Vision 分析超過 serverless 上限），Zeabur 原生支援，不需要另外找 Railway/Fly.io。
- web 與 Postgres 在同一個內網，`DATABASE_URL` 走內部位址，延遲更低且不必對外開放資料庫。

**實作上的差異（相對於原方案）**

| 項目 | 影響 |
|---|---|
| Cron | Vercel Cron 不存在。改用 Zeabur 的排程功能，或在 worker 內用 pg-boss 的 `schedule()`。**後者較佳** —— 少一個外部觸發點，且排程與 job 在同一個地方定義 |
| 建置 | Zeabur 會自動偵測 monorepo。需明確指定 `apps/web` 與 `apps/worker` 兩個服務的根目錄與啟動指令 |
| 環境變數 | 每個服務各自設定。`NEXT_PUBLIC_*` 必須同時出現在 web 服務的 build 與 runtime 變數中 |
| Supabase | 用 Zeabur 的模板部署。**auth 的 redirect URL 仍必須設定**（見下方） |

**保留不變的部分**
- R2 仍用 Cloudflare（Zeabur 沒有等價的物件儲存，且 R2 的零 egress 對背景圖片密集讀取仍是實質優勢）
- `StorageAdapter` 抽象層不變，`R2_ENDPOINT` 覆寫機制讓本機開發照舊
- 環境分離：`local` / `preview` / `production` 各自獨立的 Supabase 與 R2 bucket，禁止共用

**⚠️ 部署後必做（否則登入會靜默失敗）**
Supabase 的 `site_url` 與 `additional_redirect_urls` 必須包含正式網域。
本機踩過這個坑：沒設時 Supabase 會**退回 site_url 並從 PKCE 降級成 implicit flow**，沒有明顯錯誤訊息。

**待驗證**（Zeabur 帳號建立後）
- [ ] Zeabur 的 Supabase 模板包含哪些服務（是否有 Storage、Realtime、Edge Functions）
- [ ] worker 服務的休眠策略 —— 若閒置會被停掉，pg-boss 的排程會斷
- [ ] 建置時的記憶體上限（sharp 與 Next build 較吃資源）
- [ ] 是否支援 preview environment（PR 預覽）

---

## ADR-009 Monorepo 工具鏈

**狀態：** Proposed

- 套件管理器：**pnpm**（workspace 支援與 disk 效率）
- 任務編排：**Turborepo**（快取 build / lint / test）
- Node：**22 LTS**，以 `.nvmrc` 與 `package.json engines` 雙重鎖定
- TypeScript：**strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes**
- Lint：ESLint flat config + `@typescript-eslint`
- Format：Prettier
- Git hooks：lefthook（pre-commit 跑 format + lint，pre-push 跑 typecheck）

完整設定見 `11-engineering-setup.md`。

---

## ADR-010 i18n：單一 locale，但走 i18n 層

**狀態：** Proposed

**決策**
- Birthday Alpha 只提供 `zh-TW`。
- **但所有面向使用者的字串必須放在 message catalog**，不得硬編於 component。工具：`next-intl`。
- Key 命名：`{feature}.{component}.{purpose}`，例如 `themeStudio.saveDialog.title`。
- 例外：Agent 生成的內容、使用者輸入的內容、Daily Card 文案池（這些是資料不是介面字串）。

**理由**
補做 i18n 的成本幾乎全部在「把硬編字串挖出來」這一步。一開始就走 catalog 幾乎零成本，日後加 `en` / `ja` 只需翻譯檔。

---

## ADR-011 無障礙目標：WCAG 2.2 AA

**狀態：** Proposed

**問題**
v1.0 §11.5 已把「保證文字對比」列為主題編輯器的硬需求，但 §57.18 又把「作品分析是否包含 WCAG」列為未決。前者已經隱含需要一個明確等級。

**決策**
- **產品自身介面：** 必須符合 WCAG 2.2 **AA**。這是硬需求，不是未決事項。
- **使用者建立的主題：** Theme Studio 必須即時檢查並顯示對比比值。低於 AA 時顯示警告，但**不阻止儲存**（這是使用者的空間，我們提供資訊而非家長式管制）。低於 AA 的主題在套用時，介面關鍵元素（focus ring、錯誤訊息、disabled 狀態）自動套用高對比 fallback。
- **作品分析：** 對比檢查以本地演算法計算（可驗證的 `Metric`），輸出 WCAG 比值與等級判定。這解除 §57.18。

**具體門檻**

| 對象 | 比值 |
|---|---|
| 一般文字（< 18.66px 或 < 24px 非粗體） | ≥ 4.5:1 |
| 大字（≥ 24px 或 ≥ 18.66px 粗體） | ≥ 3:1 |
| UI 元件邊界、圖示 | ≥ 3:1 |
| Focus indicator | ≥ 3:1 對相鄰色，且面積符合 2.2 的 focus appearance |

---

## ADR-012 取色 vs Vision 的職責切分

**狀態：** Proposed

**問題**
v1.0 §42.1 要求 palette extraction < 3 秒（暗示本地演算法），但 §15.7 要求抽取「風格標籤」「可讀性問題」（必須 vision model）。兩條路徑成本相差兩個數量級，文件沒切開。

**決策**
明確切成兩條管線，且**輸出時必須標示來源**：

| 管線 | 執行位置 | 產出分類 | 延遲目標 | 成本 |
|---|---|---|---|---|
| **本地分析** | Worker（sharp + 純函式） | `Fact` / `Metric` | p95 < 3s | 零 |
| **Vision 分析** | Claude Vision（背景 job） | `Inference` / `Suggestion` | 非同步，不承諾 | 按 token 計費 |

**本地分析可產出（全部可驗證、可重現）**
- 主色 / 輔色 / 強調色（k-means on Lab 色彩空間，k=5）
- 色彩數量、飽和度分佈、亮度分佈
- 平均對比比值、未達 AA 的區域比例
- 留白比例（非邊緣像素佔比）
- 影像尺寸、長寬比、檔案大小
- 主要邊緣方向（版面是水平還是垂直主導）

**Vision 分析可產出（主觀、必帶 confidence）**
- 風格標籤（如「柔和」「編輯感」「高對比海報」）
- 版面層級判讀
- CTA 辨識與數量
- 可讀性問題的**描述**（數值仍由本地提供）
- 語言判定

**強制規則**
Vision 產出的任何陳述在 UI 上必須可追溯到 `Inference` 分類與 confidence 值。禁止把 Vision 的猜測顯示成與本地 Metric 同等級的事實。這是 v1.0 §4.4 與 §5.2 的具體執行方式。

---

## ADR-013 事件模型：一個事實來源，兩個投影

**狀態：** Proposed

**問題**
v1.0 同時存在 `activity_events`（§34.10）、`timeline_events`（§34.1）、`DomainEvent`（§36.2），三者關係未定。

**決策**

```
DomainEvent (TypeScript type)
    │  ← 傳輸格式。程式碼內傳遞、進 queue、給 consumer。不是資料表。
    ▼
activity_events (table)
    │  ← 唯一的 append-only 事實來源。所有事件都寫這裡。永不 UPDATE、永不 DELETE。
    ├──────────────────┐
    ▼                  ▼
timeline_events     analytics（外部）
（投影表）           （匯出）
```

- `activity_events`：所有 `DomainEvent` 都寫入，包含高頻的 `space.opened`。append-only。
- `timeline_events`：**只有值得被使用者看見的里程碑**才投影過來，且帶 `visibility`（private / shareable / hidden）與使用者可編輯的標題。`space.opened` 不會出現在 Timeline。
- 投影時機：event 寫入後由 `event.project` job 非同步處理，投影規則集中在 `packages/analytics/src/timeline-projection.ts`。

**理由**
使用者要能隱藏或刪除某條 Timeline 記錄，但我們仍需保留原始事件供分析與除錯。分開兩張表讓「刪掉 Timeline 上的某一天」不會破壞 Insight 的統計基礎——同時，帳號刪除時兩張表都會被清除（見 `03-database.md` 的刪除流程）。

---

## ADR-014 Memory 預設關閉

**狀態：** Proposed（解除 v1.0 §57.13）

**決策**
- `space_settings.memory_enabled` 預設 `false`。
- Memory 關閉時：Agent 不得提出記憶提案、不得檢索既有記憶、Context Builder 不注入 memory。
- Onboarding 會用一句話說明並詢問是否開啟，預設選項為「稍後再說」。
- 開啟後，仍然**只有使用者按下「記住」的內容**會變成 `approved = true`。Agent 永遠不能自行寫入 approved memory。
- `sensitivity = 'restricted'` 的內容永不自動提案。

**理由**
v1.0 §5.1 把「是否儲存記憶」列為使用者必須控制的項目。預設開啟會讓這個控制權變成事後補救。預設關閉的代價是初期個人化較弱，但這符合 §5.4 漸進式揭露。

---

## ADR-015 Daily Card：預生成 + 延遲 materialize

**狀態：** Proposed（解除 v1.0 §57.14、§57.15）

**決策**
- Cron 在使用者當地時間 04:00 為每個 active space 預生成隔日內容，寫入 `daily_items(status='pending')`。
- 使用者首次開啟時才 `status='delivered'` 並記錄 `delivered_at`。
- 24 小時後自動 `status='archived'`，**但仍可在 Archive 檢視**（v1.0 §24.4：不應永久消失）。
- Surprise 開啟後永久保存於 Archive（解除 §57.15）。
- 若使用者連續 7 天未開啟，暫停生成以節省成本；下次登入時恢復並生成當日一則。

**幂等保證**
`daily_items` 上有 `unique (space_id, local_date, kind)`。cron 重跑不會產生重複。

---

## ADR-016 字體清單（Birthday Alpha）

**狀態：** Proposed（解除 v1.0 §57.5、§57.16）

**決策：8 套，全部為可自行託管的開源授權。**

| # | 家族 | 分類 | 語言 | 授權 | 用途 |
|---|---|---|---|---|---|
| 1 | Noto Sans TC | sans | zh-TW, en | OFL 1.1 | UI 預設 / 內文 |
| 2 | Source Han Sans TC / 思源黑體 | sans | zh-TW, ja, en | OFL 1.1 | 內文替代、較多字重 |
| 3 | Noto Serif TC | serif | zh-TW, en | OFL 1.1 | 標題（中文明體） |
| 4 | LXGW WenKai TC / 霞鶩文楷 | handwriting | zh-TW, en | OFL 1.1 | 柔和 / 手寫感 |
| 5 | Inter | sans | en | OFL 1.1 | 英文 UI |
| 6 | Playfair Display | display | en | OFL 1.1 | 英文標題 |
| 7 | Cormorant Garamond | serif | en | OFL 1.1 | 英文襯線內文 |
| 8 | JetBrains Mono | mono | en | OFL 1.1 | 等寬 / 程式碼 |

**全部為 OFL 1.1，因此統一滿足：** 可商用、可網站嵌入、可自行託管、可轉 WOFF2、可修改（衍生檔須沿用 OFL）。**不需要**在 UI 顯示署名，但**必須**在 `/settings/about/fonts` 提供授權清單與連結，並在 R2 的字體目錄保留原始 `OFL.txt`。

**使用者上傳自有字體：Birthday Alpha 不支援。** 理由是無法驗證使用者上傳字體的授權範圍，一旦託管即由我方承擔散布責任。V2 再議。

**繁中載入策略**
Noto Sans TC 完整字集約 6–9 MB，不可能整包載入。採 **unicode-range 分片**：
- 依字頻切成約 100 個 subset（常用 3000 字集中在前 5 片）
- 每片 `font-display: swap`
- 瀏覽器只下載頁面實際用到的片
- 首屏 CSS 只 inline UI 字體的前 3 片（約 60 KB）

實作細節見 `05-theme-tokens.md`。

---

## ADR-017 測試工具鏈

**狀態：** Proposed

| 層 | 工具 | 門檻 |
|---|---|---|
| Unit / 純函式 | Vitest | `packages/*` 覆蓋率 ≥ 80% |
| Component | Vitest + Testing Library | 關鍵互動元件必測 |
| API contract | Vitest + supertest 風格 | 每個端點至少 1 成功 1 失敗 1 授權案例 |
| DB / RLS | Vitest + 真實 Postgres（testcontainers） | **每張表的 RLS 必測跨 space 拒絕** |
| Provider adapter | Vitest + MSW（錄製的真實回應） | 禁止手寫理想化 mock |
| E2E | Playwright | v1.0 §45.2 的 14 條流程 |
| A11y | axe-core（整合進 Playwright） | 0 個 critical / serious violation |
| Visual regression | Playwright screenshot | Theme 套用後的 Home Space |

**RLS 測試是不可協商的。** 每張帶 `space_id` 的表都必須有一個測試證明：以 space B 的使用者身分查詢，看不到 space A 的資料。

---

## ADR-018 Feature Flag 機制

**狀態：** Proposed

**決策**
- 定義存在 `feature_flags` 表（全域預設）+ `space_feature_overrides`（per-space 覆寫）。
- 讀取：server 端在 request 開始時載入該 space 的 flag map，快取 60 秒（in-memory LRU）。
- 傳遞：透過 React Server Component 的 context 傳給 client，client 不再打 API。
- 型別：flag key 是 TypeScript union type，不是 string，新增 flag 必須改型別定義（避免拼錯默默回傳 false）。

```ts
export type FeatureFlagKey =
  | 'figmaIntegration'
  | 'canvaConnect'
  | 'canvaApp'
  | 'adobeExpress'
  | 'photoshopPlugin'
  | 'publicPortfolio'
  | 'collaboration'
  | 'marketplace'
  | 'videoBackground'
  | 'semanticSearch'
  | 'weeklyRecap'
```

**強制規則**
Flag 為 false 時，相關的**路由必須回 404、API 必須回 404**，不只是隱藏按鈕。隱藏按鈕但保留可存取的端點是假關閉。

---

## ADR-019 影片背景：Alpha 支援，但有硬限制

**狀態：** Proposed（解除 v1.0 §57.19）

**決策**
- Birthday Alpha **支援**影片背景，於 `feature.videoBackground` flag 之後。
- 限制：≤ 30 秒、≤ 20 MB、僅 `video/mp4` (H.264) 與 `video/webm` (VP9)。
- Alpha **不轉碼**，直接播放原檔。超過限制的檔案在上傳時就拒絕，並明確告知原因與限制數字。
- V1 才加入轉碼 job（產生 720p / 1080p 兩檔）。

**必要的播放行為（不可省略）**
- 一律 `muted` + `playsinline` + `loop`
- `document.visibilityState !== 'visible'` 時暫停
- `prefers-reduced-motion: reduce` 時，改為顯示影片的第一幀靜態圖（由 worker 預先抽出並存為 rendition）
- 行動裝置且 `navigator.connection.saveData === true` 時，同樣降級為靜態幀
- 必須提供使用者可見的暫停控制（WCAG 2.2 的 Pause, Stop, Hide）

---

## ADR-020 Theme 分享：Alpha 只做檔案匯出匯入

**狀態：** Proposed（解除 v1.0 §57.17）

- Birthday Alpha：`GET /api/themes/:id/export` 下載 JSON，`POST /api/themes/import` 上傳 JSON。無伺服器端分享、無公開連結。
- 匯入時必須以 zod schema 驗證，且**只接受 token 值，不接受任何可執行內容**（防止透過主題 JSON 注入 CSS）。
- 匯入的字體引用若不存在於本地 `fonts` 表，降級為同分類的預設字體並提示使用者。
- V2 才做線上分享與 Theme Marketplace。

---

## ADR-021 Agent 速率與成本上限（免費／付費分開計）

**狀態：** Proposed（配合 ADR-023 修訂）

**決策**
免費呼叫與付費呼叫**分開計額**。免費層給寬鬆上限（只防濫用與失控迴圈），付費層給嚴格上限（防帳單意外）。

**免費層上限**

| 限制 | 值 | 超過時 |
|---|---|---|
| 對話訊息 | 200 則 / space / 日 | 顯示已達上限，明日重置 |
| 併發請求 | 2 / space | 排隊 |
| 單次輸入 token | 30,000 | Context Builder 依優先序裁切（見 `07-agent.md`） |
| 單次輸出 token | 2,000 | — |

**付費層上限（升級路徑）**

| 限制 | 值 | 超過時 |
|---|---|---|
| 升級呼叫 | 20 次 / space / 日 | 停用「深入分析」按鈕並說明，對話**仍可用免費模型繼續** |
| Vision 深度分析 | 10 次 / space / 日 | 分析按鈕停用；本地 Metric 與免費 Vision 仍可用 |
| 單次輸入 token | 30,000 | 同上 |
| 單次輸出 token | 4,000 | — |
| 全站月成本上限 | 由 `ai_provider_keys.monthly_budget_usd` 控制 | 達標後付費候選全部停用，系統自動只走免費層 |

**主動訊息：3 則 / space / 日**，且一律只用免費模型。

**降級而非失敗（強制）**
付費額度用盡時，系統必須**自動降級到免費模型並完成請求**，同時在 UI 標示「本次使用快速模式」。禁止直接報錯或靜默失敗——這是 v1.0 §46.2「不生成假結果」的反面：也不能因為省錢就讓功能整個消失。

**必要行為**
所有 AI 呼叫（含免費）寫入 `ai_usage_log`：space_id、usage_key、provider、model、is_free、fell_back、escalated、input/output token、cache read/write token、成本估算、延遲。這張表是成本歸因、異常偵測與「哪些用途其實不需要付費模型」的分析基礎。

---

## ADR-022 儲存配額

**狀態：** Proposed

| 項目 | Alpha 上限 |
|---|---|
| 單一圖片 | 25 MB |
| 單一影片 | 20 MB |
| 單一 PDF | 50 MB |
| Space 總容量 | 5 GB |
| 單次批量上傳 | 20 個檔案 |
| Signed URL 有效期（讀） | 15 分鐘 |
| Signed URL 有效期（寫） | 10 分鐘，單次使用 |
| 未完成上傳保留 | 24 小時後由 GC 清除 |

超過 space 總容量時：拒絕新上傳，顯示目前用量與最大的 5 個檔案，提供刪除入口。**不可** 靜默失敗或截斷檔案。

---

## Deferred — 明確延後且不阻塞

| v1.0 § | 項目 | 延後理由 | 需在何時決定 |
|---|---|---|---|
| 57.1 | 正式產品名是否為 SnowRealm Space | 純命名，不影響 schema。程式碼一律用 `snowrealm` 前綴，品牌字串走 i18n catalog | 公開發布前 |
| 57.2 | Nami Space 是獨立品牌或 Space Template | ADR-003 的多租戶架構讓兩者都可行 | V1 |
| 57.3 / 57.4 | Agent 外觀與名稱 | `agent_profile` 表已預留 `display_name` / `avatar_asset_id`，可隨時改 | Milestone D 開始前 |
| 57.6 | 是否加入背景音樂 | 獨立 widget，不影響核心架構 | V1 |
| 57.7 | 生日當天固定劇情 | 內容問題非架構問題，`09-content-pool.md` 已預留生日鏈結構 | 內容撰寫時 |
| 57.10 | Figma 是否趕在生日版 | ADR-001 取消硬期限後此題消失。Figma 排在 Milestone F | — |
| 57.20 | 是否需要公開 Portfolio Route | 在 `feature.publicPortfolio` flag 之後，V2 | V2 |

---

## 決策對照表 — v1.0 §57 全數收斂

| # | v1.0 未決事項 | 收斂於 | 結果 |
|---|---|---|---|
| 1 | 正式產品名稱 | Deferred | 程式碼用 `snowrealm`，品牌走 i18n |
| 2 | Nami Space 定位 | Deferred | 架構兩者皆支援 |
| 3 | Agent 外觀 | Deferred | schema 已預留 |
| 4 | Agent 名稱 | Deferred | schema 已預留 |
| 5 | 初始字體清單 | ADR-016 | 8 套 OFL 字體，已列表 |
| 6 | 背景音樂 | Deferred | V1 |
| 7 | 生日固定劇情 | Deferred | 結構已預留 |
| 8 | Alpha 是否登入制 | ADR-003 | Magic link + 邀請制 |
| 9 | 沿用 SnowRealm Account | ADR-003 | Supabase Auth 獨立 |
| 10 | Figma 趕生日版 | ADR-001 | 排 Milestone F |
| 11 | 使用哪個 LLM | ADR-004 | Claude |
| 12 | 使用哪個 Vision Model | ADR-004 | Claude Vision |
| 13 | Memory 預設是否關閉 | ADR-014 | 預設關閉 |
| 14 | Daily Card 是否自動生成 | ADR-015 | Cron 預生成 + 延遲 materialize |
| 15 | Surprise 是否保存 Archive | ADR-015 | 永久保存 |
| 16 | 允許上傳自有字體 | ADR-016 | Alpha 不支援 |
| 17 | Theme 是否允許分享 | ADR-020 | Alpha 只做檔案匯出匯入 |
| 18 | 作品分析是否包含 WCAG | ADR-011 | 包含，本地演算法計算 |
| 19 | 是否支援影片背景 | ADR-019 | 支援，有硬限制 |
| 20 | 公開 Portfolio Route | Deferred | V2 |
