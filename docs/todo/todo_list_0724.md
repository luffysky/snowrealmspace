# SnowRealm Space 待辦總表（2026-07-24 建，2026-07-25 更新 · 現行主檔）

> 本檔＝目前**未完成**待辦主檔。0723 及更早的完成劃線見 `todo_list_0723.md`（不刪、當歷史）。
> 圖例：⬜ 未做 · 🚧 進行中（部分完成）· 🔴 需 Luffy 本人操作 · 🆕 新想法/參考 · ＊ 原則/約束。
> **完成的用刪除線標記、不要刪。** 狀態依實際程式碼核對（文件常落後）。
> 里程碑層級完成度總覽見 `docs/spec/91-backlog.md`；每日工作紀錄見 `docs/worklog/`。

---

## 進度總覽

| Milestone | 狀態 | 完成度 |
|---|---|---|
| A — Foundation | ✅ 完成 | 100% |
| B — Visual Personalization | ✅ 幾乎完成 | ~98%（剩 Q10 手動走查、台北黑體字檔） |
| C — Creative Core | ✅ 幾乎完成 | C1–C7 全數完成（地基/Projects/Library/作品+版本比較/Timeline/from-image/隱私刪除組）；剩空間整體刪除（需 R2+worker） |
| D — AI Core | 🚧 大幅完成 | 路由層+對話+工具+記憶+語氣+**SSE串流**+**vision**+**embedding語意檢索**全備（119 ai-core 測試）；剩對話歷史摘要、金鑰額度調校 |
| 管理後台 | ✅ 頁面全補齊 | AI 金鑰/模型/候選鏈/用量/額度/快取 + Agent 動作/內容池/Flags/Space·使用者/系統/稽核（唯讀為主，編輯項見清單） |
| E — Daily Loop | ✅ 完成 | cron 掃時區+weekly recap 補齊；剩 Insight LLM 升級（需金鑰） |
| F — Integration | 🚧 骨架 | adapter/capabilities/webhook 冪等完成；OAuth/sync 需 Figma 憑證 |
| 部署 / 帳號 | 🚧 進行中 | 站台閘門、密碼註冊、hosted 建表已通；SMTP/R2/worker 待設 |

---

## 🅰 需 Luffy 本人操作 🔴

- 🔴🔴 **Zeabur redeploy 抓最新 commit（最優先）** — 註冊 500 修復（R2 optional）、帳密體驗、
      深淺色、E 全部新功能（Insight/通知/主動訊息/驚喜收藏）都要 redeploy 才會上線。
- 🔴 **Resend 寄件人網域** — SMTP 已連上，但 `Error sending confirmation email` 是因寄件人在沙盒。
      把 auth 服務的 `GOTRUE_SMTP_ADMIN_EMAIL` 設成 `service@snowrealm.pet`（已驗證網域）→ 重啟 auth。
      設好後 magic link 登入才對外可用（**帳號密碼登入已可用、不受此影響**）。
- [x] ~~**Cloudflare R2** — env（account/key/bucket）已設好（Luffy「env 跟 r2 都用好了」）~~
- [x] ~~**R2 bucket CORS** — 已貼 CORS policy，瀏覽器直傳可通~~
- [x] ~~**部署 worker 服務** — 已啟動（背景圖處理/場景/排程都靠它）~~
- [x] ~~**hosted migrations** — 已套到 **0037**（含 Lottie `type`/`lottie_id`）；每加 DB 欄跑 `pnpm db:migrate`~~
- 🔴 **JWT secret** — Zeabur Supabase 仍用 demo 預設 secret（key 的 iss=supabase-demo）。**正式對外前必換**，換完重新產 anon/service key 更新 env。
- 🔴 **Q10 手動走查** — 人實際點過 Milestone B 一輪（主題/背景/字體/版面）。
- 🔴 **台北黑體字檔** — 沒有穩定下載網址，需人工下載。**下載來源見 `docs/fonts/README.md`**（翰字鑄造 JT Foundry <https://sites.google.com/view/jtfoundry/>）。
      **✅ 0726：不用再跑 CLI** —— 後台 `/admin/fonts`（外觀資源 → 字體管理）可直接上傳字體檔＋OFL 授權即時安裝（子集化在 route 內完成）。
- 🔴 **AI 金鑰**（Milestone D）— **改為後台管理**（照 ai 島）：
      - Zeabur web 只需設**一把** `AI_KEY_ENCRYPTION_SECRET`（base64 的 32 bytes，master 加密金鑰）
      - 各家 provider 金鑰到網站 **`/admin/ai-keys`** 貼上（會先測試才加密存 DB），不放 Zeabur env
      - 至少 Groq + Gemini 兩把免費（後台有取得連結）；設好 Agent 對話就能運作
      - 站台管理員身份：email `luffysky00@gmail.com`（或 `OWNER_EMAILS`/`OWNER_USER_IDS` env）
- 🔴 **Figma app 憑證**（Milestone F）— `FIGMA_CLIENT_ID` / `FIGMA_CLIENT_SECRET` / `FIGMA_WEBHOOK_SECRET`，redirect URI 用正式網域。
- 🔴 **Google / LINE 登入憑證**（程式碼已完成，只差憑證；沒設按鈕會停用不會壞）— 由 0723 沿用：
      - Google Cloud Console → OAuth consent screen + Client ID → `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`（並在 Supabase → Auth → Providers 開啟）
      - LINE Login channel → `LINE_LOGIN_CHANNEL_ID` / `LINE_LOGIN_CHANNEL_SECRET` / `LINE_LOGIN_REDIRECT_URI`（callback URL 要完全一致）
      - LINE email 權限申請（需說明用途）
      - **隱私權政策頁**（Google/LINE 審核前置）
- 🔴 **內容決定** — Agent 名字/外觀（D 前）；生日鏈第 5 環「一年後」要放什麼（已有 AI 代寫版，可換）；
      **正式產品名稱**（公開發布前，程式碼用 `snowrealm` 前綴、品牌走 i18n）。背景音樂已完成（可選）。

---

## 〇、部署 / 帳號系統

- [x] ~~站台密碼閘門（進站先輸入密碼；middleware 攔全站，密碼伺服器端比對）~~
- [x] ~~帳號密碼註冊/登入（繞過 SMTP，馬上能進站）~~
- [x] ~~帳號可用使用者名稱（不必 email，可先設好再交給對方）~~
- [x] ~~註冊後引導綁定 Google/LINE~~
- [x] ~~密碼強度判斷 + 強度條、顯示/隱藏眼睛（PasswordField）~~
- [x] ~~忘記密碼 `/forgot` + `/reset-password`（真 email 才寄、防帳號枚舉）~~
- [x] ~~登入後對「沒救援方式的帳號」跳綁定提醒橫幅（BindingReminder）~~
- [x] ~~註冊 500 修復：R2 env 全改 optional（缺 R2 不再拖垮全站）~~
- [x] ~~milestone-a 閉環腳本帶站台閘門 cookie（CI 修復，本地 24/24）~~
- [x] ~~hosted Supabase：16 migration + seed + RLS 30 表~~
- [x] ~~內容池 8324 則灌入 hosted content_items~~
- [x] ~~首頁 `/` 500 防護、lint 與 build 解耦~~
- [x] ~~RWD 稽核：nav 加鈴鐺/日夜鈕後不破版；通知面板手機改 fixed 貼齊視窗~~
- [x] ~~**導覽重構**（0725）：桌機可收合側邊欄（圖示軌道）、手機漢堡抽屜、時間差動畫、aria-current 高亮；取代 flex-wrap 排列~~
- [x] ~~Sentry / 監控~~ ✅ 0726 Sentry-lite（DSN-gated，設 SENTRY_DSN 即啟用）
- [ ] `/api/health` 全綠（等 R2 + worker）
- [ ] preview 與 production 用不同 Supabase / R2 bucket
- [ ] preview 不設付費 AI 金鑰 → 自動全走免費模型，PR 不產生帳單
- [ ] Next `output: 'standalone'`（縮小映像檔，首次部署以正確性優先，之後再開）
- [x] ~~lefthook git hooks~~ ✅ 0726（pre-commit secrets+lint / pre-push typecheck+deps）
- [ ] 小技術債（0723 沿用）：`packages/db` 未列規格 §53（已記 build log）、migration 編號與規格 §0 規劃不同（按 Milestone 順序建立）
- [ ] E2E/a11y 在 CI 一直 churn — Luffy 要求暫停跑；日後要重新穩定（gate 全域 setup、
      環境對齊）再開。目前改靠 typecheck/單元/RLS/直連 DB 驗證。

---

## 🅱 Milestone B — 剩餘

- [x] ~~字體系統：13 套字體、分片、選擇 UI、SSR 注入、字體配對~~
- [x] ~~影片時長雙層檢查、三種轉場、輪播、時段排程 UI~~
- [x] ~~Widget 設定面板（自動生成）、隱藏、鎖定、版面切換~~
- [x] ~~毛玻璃數量上限、視覺回歸（opt-in）~~
- [x] ~~Layout preset 多套版面~~ ✅ 0726：6 套範本（預設/專注/創作/每日/極簡/總覽）+ CRUD + key 修復
- [ ] poster frame 抽取（需 ffmpeg，排到 C）
- [ ] Visual regression 基準擴充到更多頁

---

## 🛠 站台管理後台（`/admin/*`，站台管理員身份）

> 照 ai 島架構逐步擴充。身份走 `lib/auth/site-admin`（多 signal）。
> **0725：其餘頁全數補齊。** 唯讀檢視為主（誠實：檢視 vs 編輯分清楚，見各項備註）。

**AI 管理**（表都建好了）
- [x] ~~AI 金鑰管理 `/admin/ai-keys`（各家加密存 DB、測試、啟用/移除）~~
- [x] ~~**AI 模型管理** `/admin/ai/models`（啟用/停用、免費、串流·工具·視覺標記，PATCH）~~
- [x] ~~**候選鏈檢視＋編輯** `/admin/ai/candidates`~~ ✅ 0725：合併 DB 覆寫＋內建預設顯示，可 ▲▼ 調序／啟用覆寫／重設回預設（PATCH/DELETE）
- [x] ~~**AI 用量／成本儀表板** `/admin/ai/usage`（總成本、免費vs付費、escalate/fallback/degraded/cache 率）~~
- [x] ~~**每日額度檢視＋上限設定** `/admin/ai/quota`~~ ✅ 0725：新增 ai_quota_config（0039），免費/付費上限可後台改，deps.ts 改讀設定（原寫死 300/20）
- [x] ~~**回應快取檢視** `/admin/ai/cache`（命中率、scope、過期狀態）+ 清除（清過期/全部清空）~~ 〔0725 加清除；per-usage 失效待做〕
- [x] ~~內容審核關鍵字後台編輯~~ ✅ content_filter_patterns（0040）+ /admin/content-filters

**系統／營運**
- [x] ~~**Feature flags 管理** `/admin/flags`（全域旗標即時切換 PATCH + 樂觀更新/回滾；space 覆寫唯讀）~~
- [x] ~~**系統健康儀表板** `/admin/system`（job_records 佇列統計、失敗清單、空間/檔案數）~~
- [x] ~~**稽核日誌檢視** `/admin/audit`（audit_logs）~~
- [x] ~~**Agent 動作檢視** `/admin/agent-actions`（工具呼叫紀錄、失敗、需確認標記）~~
- [x] ~~站台管理員角色 DB 授予/撤銷~~ ✅ /admin/users（owner 改 site_role）
- [x] ~~整合/webhook 狀態頁~~ ✅ /admin/integrations（provider_webhooks 收件記錄）

**內容／空間**
- [x] ~~**內容池檢視＋審核** `/admin/content`~~ ✅ 0725：每則可啟用/停用（PATCH，樂觀更新）〔新增文案/編輯權重/生日鏈編輯仍待做〕
- [x] ~~**Space/使用者管理** `/admin/spaces`（列出 spaces/擁有者/成員數/隱私/狀態 + 使用者/登入方式）~~ 〔唯讀；佈建/孤兒修復待做〕

## 🅕 Milestone F — Integration（骨架起）

- [x] ~~`@snowrealm/provider-core`：ProviderCapabilities（前端只顯示支援、禁 Coming Soon）、
      DesignProviderAdapter 介面、FigmaAdapter、HMAC 簽章驗證、webhook 冪等（12 測試）~~
- [x] ~~GET /api/integrations（capability matrix）+ POST /api/webhooks/:provider（驗簽+冪等+快回 200）~~
- [x] ~~middleware 豁免 /api/webhooks/*（外部呼叫）~~
- [ ] 🔴 **Figma app 憑證**（client id/secret）→ OAuth connect/callback、figma.sync job 才能實作
- [x] ~~worker 部署~~ ✅（Luffy 已啟動）

## 🅴 Milestone E — Daily Loop

- [x] ~~內容池：語錄 3745 / 提示 3661 / 問候 268 / 驚喜 645 / 生日鏈+信（AI 代寫，10 年份量）~~
- [x] ~~content_items / daily_items / surprises 建表 + seed~~
- [x] ~~選取演算法（冷卻、去重、tag 避重、決定性加權；22 測試）~~
- [x] ~~每日卡片 Home widget（問候 + 語錄 + 提示）~~
- [x] ~~驚喜盒（依稀有度機率、每日一盒、美化開盒動畫）~~
- [x] ~~生日鏈（條件解鎖、Home 全寬呈現）~~
- [x] ~~Surprise 稀有度**保底計數器**（連 15 盒沒 rare 保底）+ 機率公開頁~~
- [x] ~~Surprise archive（開過的收藏頁 `/surprises`、收藏★、只看收藏）~~
- [x] ~~主動訊息：觸發條件（里程碑/每日）、頻率上限 3/日、Quiet hours、`FORBIDDEN_PATTERNS` 攔截（規則式，D 有 AI 再升級）~~
- [x] ~~Insight Engine：5 種 fact/metric 類型、evidence.sourceIds + confidence（`/insights` 每週回顧、可刪）~~
- [x] ~~Notification：in-app 鈴鐺、分類、已讀、一鍵關閉、Quiet hours（設定頁）~~
- [x] ~~Agent 訊息 widget 實作（進 Home 觸發主動訊息、顯示最新一則）~~
- [x] ~~深淺色切換（選項 A：任何主題自動算暗色版、nav 日/月鈕、cookie 記住）~~
- [x] ~~cron 掃時區主動生成（daily-engine 共享套件 + worker daily-cron handler，每小時掃、當地 04:00 生成）~~
- [x] ~~Weekly Recap 專屬通知（當地週一 09:00 生成回顧 + weekly_recap 通知，冪等）~~
- [x] ~~Insight 升級（AI 深入回顧）~~ ✅ 0726：/api/insights/generate（weekly_recap→suggestion，clampStatement，graceful）

---

## 🅲 Milestone C — Creative Core（進行中）

> 拆成 7 個閉環 phase，依相依性推進：C1 地基 → C2 Projects → C3 Library →
> C4 design/snapshot+版本比較 → C5 Timeline → C6 from-image 收尾 → C7 隱私刪除組。

- [x] ~~**C1 地基**：migration 0017（projects/design_files/design_snapshots/design_insights/
      design_connections/provider_webhooks）+ 0018（timeline_events）+ 0019（assets 加
      is_favorite/archived_at/tags + pg_trgm 檔名索引）。RLS 30→37 表、跨 space 隔離測試、
      on delete restrict、型別重生。19 migration 從零 reset 綠~~
- [x] ~~**C2 Project CRUD**：projectCreate/Patch/ListQuery schema（13 測試）；
      GET/POST/PATCH/DELETE `/api/projects`（狀態事件、軟刪不刪作品）；
      `/projects` UI（建立/編輯/狀態篩選/標籤/封面縮圖/四態）+ nav 入口 + CSS token~~
- [x] ~~**C3 Library 升級**：篩選（kind/tag/收藏/封存）+ pg_trgm 檔名搜尋 +
      asset actions（改名/刪除/建主題/tag/收藏/封存/設為作品）~~
- [x] ~~**C4** design_files+design_snapshots API（從 asset 建作品、快照、去重）+
      版本比較（並排/疊圖/滑桿 + compareLocalFeatures 數值差異）+ /works UI~~
- [x] ~~**C5 Timeline**：event.project job（投影規則+節流+冪等）、0020 append-only trigger、
      三檢視、編輯/隱藏/刪除、/timeline UI~~
- [x] ~~**C6 from-image 收尾**：3 變體/可重現/textPrimary≥4.5 已測；抽 draftsFromLocalFeatures
      並修 C4 compare 巢狀結構 bug~~
- [x] ~~**C7 隱私刪除組**：引用檢查涵蓋 design_snapshot（不可 cascade）/project 封面/timeline 封面；
      資料地圖頁 /settings/data~~
- [x] ~~空間/帳號整體刪除（7 天寬限、匯出、R2 先於 DB）—— 見「跨里程碑：隱私與刪除」，已完成~~
- [ ] 本地分析擴充：對比檢查、留白比例（已有 whitespaceRatio）、textZoneLuminance

---

## 🅳 Milestone D — AI Core（基礎完成，需金鑰接續）

- [x] ~~`packages/ai-core` 純核心：usage-keys、providers（9家/3協定/endpoint/名稱解析/
      surrogate清理/計費/cache marker）、errors（isQuotaOrTransient/looksLowConfidence）、
      circuit-breaker、candidates（排序/升級/濾付費）、cache-key、default-candidates（93 測試）~~
- [x] ~~`runCandidateChain` 編排演算法：fallback/升級一次/缺金鑰跳過/真錯直接拋/degraded（§11 端到端 10 測試）~~
- [x] ~~migration 0023：ai_models/provider_keys/usage_models/usage_log/daily_quota/response_cache + RLS~~
- [x] ~~ESLint 禁直接 import AI 廠商 SDK（本就存在，ai-core 已豁免）~~
- [x] ~~**callAI**（3 協定 HTTP client）+ keys.ts（AES-256-GCM，DB→env→null）—— 74 測試~~
- [x] ~~**completeForUsage 全整合**：預算閘門 + 快取 + ai_usage_log + degraded（DI，mock 測試）~~
- [x] ~~**buildCompleteDeps** 接真 Supabase + migration 0024 額度累計函式 + seed（9 模型/18 用途）~~
- [x] ~~**五分類 clampStatement**（fact/metric/inference 證據強制、inference≤0.85、丟無效保其餘）~~
- [x] ~~整合驗證 verify-d-routing：無金鑰時候選鏈/預算/跳過/誠實失敗全對~~
- [ ] 🔴 **設定 AI 金鑰**（Groq + Gemini 兩把免費）→ Agent 對話才能真的產生回應（基礎全備）
- [x] ~~Agent system prompt + context builder（主題/記憶/原則/活動/選取作品，反幻覺分支）~~
- [x] ~~Agent 對話 UI（/agent，訊息氣泡、無金鑰優雅降級保留輸入、degraded 提示）~~
- [x] ~~10 tool 註冊表 + 執行流程（agent_actions 生命週期、確認閘門、24h undo；verify-d-tools 驗證）~~
- [x] ~~Memory（提案→批准、Memory Center、ADR-014 雙重防護）~~
- [x] ~~**Agent 語氣**（參考 AI 島 persona）：settings 選 warm/gentle/professional/playful/concise
      → space_settings.agent_tone → renderContextSuffix 注入；未知值不注入。3 反向測試~~
- [x] ~~SSE 串流~~ ✅ 0726：ai-core callAIStream + /api/agent/chat/stream + AgentChat 逐字（實測 Groq 14 chunks）
- [x] ~~UI 五分類視覺區別~~ ✅ 0726：Insight 五分類徽章
- [x] ~~設計視覺分析 light/deep~~ ✅ 0726：/api/design/vision（複用多模態，graceful）+ 修停役 vision 模型 + 補 OpenAI fallback
- [x] ~~embedding 記憶語意檢索~~ ✅ 0726：ai-core embedText(768維) + match_memories RPC + approve/新增即時嵌入 + Memory Center 搜尋框 + Agent context RAG + backfill 腳本（實測 OpenAI sim=0.41 命中）
- [ ] 對話歷史摘要（長對話壓縮，尚未做）

---

> Milestone F 進度見上方「🅕 Milestone F — Integration（骨架起）」。

---

## 跨里程碑：隱私與刪除

- [x] ~~刪除單一 asset / 主題 / 背景 / 播放清單~~
- [x] ~~`storage.gc`：逾期上傳與軟刪除滿 30 天的清除~~
- [x] ~~**刪除 space**（軟刪除 + 7 天寬限 + 還原 + space-purge job，R2 先於 DB；0028-0030）。
      順帶修掉 `activity_events` 的 `DO INSTEAD NOTHING` delete rule 連 CASCADE 也擋的潛在 bug~~
- [x] ~~**刪除帳號**（清名下 space + 刪 auth.users；跨 space 事件 actor 匿名化為 NULL）。
      0031 讓 content_guard 放行 actor_id→NULL 但禁改成他人。verify-account-delete~~
- [x] ~~帳號匯出（改 JSON，比 zip 更可攜/可再匯入）、AI 資料聲明頁（settings/ai-data）、資料地圖頁（settings/data）~~

---

## 媒體 / 主題增強（🆕 Luffy 0724 追加，已完成）

- [x] ~~起始主題 4 → 12 套（森/暮/海/墨/蜜/薰衣草/珊瑚），全過 AA~~
- [x] ~~背景：單色（兩同色停漸層）+ 漸層顏色編輯器（色停 picker + 角度）~~
- [x] ~~單檔上限 50MB → 500MB（ADR-022 偏離）；影片 mp4/webm/ogg/mov + audio kind~~
- [x] ~~影片可選聲音（ADR-019 偏離）：muted 使用者可控，首次手勢解除靜音~~
- [x] ~~背景音樂：space 選 audio + nav 播放器（手動播放遵守 autoplay 政策）+ 設定頁~~
- [x] ~~**內建動態場景**（canvas 粒子，可疊加/密度可調）+ 獨立動態背景~~ ✅ 0725 追加 19 個 → 共 67
- [x] ~~**漸層編輯器**（線性/放射/多點網狀，點選定位色點）+ 幻燈片即時生效~~
- [x] ~~**Lottie 動畫背景** 5 個自製（CC0/專案自有），lottie-web light 懶載入、reduced-motion/省流量降級；
      0037 加 type=lottie+lottie_id。以 jsdom+真實播放器逐格驗證（抓到並修 keyframe 缺 i/o 把手 bug）~~

## 深淺色切換（🆕 Luffy 0724 提出）

- [x] ~~**明/暗模式切換（選項 A）** — deriveDarkTheme 為任何主題自動算暗色版
      （保留色相個性、確保 4.5 對比）、nav 日/月鈕、cookie 記住、SSR 不閃、切換 <150ms~~

---

## 技術債

- [ ] `--sr-font-*-id` 舊註解（已解，可清）
- [x] ~~widget config projectId 選擇器~~ ✅ 0726：project 型欄位改專案下拉
- [ ] `apps/web/lib` 部分邏輯無單元測試（靠 E2E）
- [x] ~~`QuickNoteWidget` 存 localStorage~~ ✅ 0725 改存 widget_notes 表（0038，RLS by space_id），跨裝置可見、自動存雲端
- [ ] 測試 env 指向 hosted 會污染正式資料 — 已有 cleanup 腳本，但流程要小心
- [ ] Insight 軟刪除後，下次 `generateInsights` 的 upsert 會更新到同一列但 `deleted_at` 仍在
      → 被刪的回顧不會自動復活（可接受；若要「刪了就不再出現該週期」則需在 upsert 前濾掉）
- [x] ~~主動訊息改 cron 掃時區~~ ✅ 0726：收斂到 worker cron 一條路徑，Home 改只讀
- [ ] `apps/web/lib/insights`、`lib/daily/proactive`、`lib/notifications` 尚無單元測試
      （引擎邏輯已用 `scripts/verify-milestone-e.ts` 直連 DB 驗證，但缺純函式單測）

---

## 🗺️ 產品路線圖（0725 全面盤點，優先序）

> 來源：全面盤點 agent（讀憲章＋規格＋平台計畫＋所有路由）。
> **近期佇列 B → A → C/D**（Luffy 定）。**貼 AI 金鑰（Groq＋Gemini）→ 所有 AI 生成功能全亮**。

### 0726 進度（實地盤點 + 一批完成）
- [x] ~~Agent 多模態~~：圖片(vision，新 agent_chat_vision 候選鏈)／檔案(前端讀文字)／語音(Groq whisper `/api/agent/transcribe`)
- [x] ~~**生日通知 critical bug**~~：`notifications` CHECK 不含 'birthday' → 生日當天靜默失敗（旗艦功能）。0044 修好。
- **4 個 agent 實地盤點結論（別再信 91-backlog 的「0%」）**：
  - B 視覺補漏 **全數已實作**（轉場/排程UI/輪播/layout/widget設定面板/毛玻璃上限）。
  - 隱私刪除 **大多已實作**（刪帳號/snapshot/memory）；只缺匯出 ZIP（邊際價值低）。
  - 主動訊息 **已 cron-wired**；已把 Home 觸發收斂掉消除競態。週報 in-app 已有（缺 email 供應商）。
- **卡決策/外部（等 Luffy）**：公開作品集頁（對外曝光可見性模型）、訪客分享模型、Email 供應商金鑰、字體檔、Figma 憑證、Sentry DSN、AI Dot 定價。

### 近期佇列（純程式，不卡外部）
- [x] ~~幹掉 window.prompt/confirm + 資產選擇器 modal~~ ✅ DialogProvider + AssetPicker
      最醜：Works「新增版本」要手貼 asset UUID、WorkDetail 寫死 initialFiles[0]；
      Home 版面建立/命名、Library 資料夾/標籤/移動(數字選單)、Timeline 命名。做一個 modal + asset-picker 原語貫穿。
- [x] ~~接上 Agent 工具迴圈~~ ✅ 10/10 handler + 確認/24h 復原
      chat route 沒把 `tools` 傳進 `completeForUsage` → 整套工具系統是死程式。
      傳 `toProviderTools()` + 跑工具迴圈 + 補 6 個 handler：create_note / create_theme_draft /
      create_palette / add_background / compare_design_versions / create_daily_card（現有 4/10）。
      確認/拒絕/24h 復原/稽核生命週期已完成。
- [ ] **C. Trust Level L0–L3 ＋ SnowRealm+（Space 版）** — 經濟層唯一不卡決策的；接在 `profiles.privileged` 上，防濫用閘門
- [ ] **D. AI Dot 帳本基礎建設** — append-only 雙分錄、餘額=sum、冪等扣點 keyed on `ai_usage_log.id`；**卡 Luffy 定價表**

### 升級現有（Bucket 1）
- [x] ~~clampStatements 五分類 UI~~ ✅ 0726：fact/metric/inference/suggestion/creative 徽章+evidence+可信度
- [x] ~~SSE 串流 agent chat~~ ✅ 0726：/api/agent/chat/stream + AgentChat 逐字（實測 Groq）
- [x] ~~Theme AI 配色~~ ✅ 0726：paletteFromMood 心情→三套配色（本地，不需金鑰）
- [x] ~~embedding 記憶語意檢索、設計視覺分析（淺/深）、Insight 升級（推論/建議/創意）~~ ✅ 0726：三項全清，皆 live 驗過（OpenAI/Groq）
- [ ] （字體檔）Font system 收尾

### 新功能（Bucket 2）
- [x] ~~隨手捕捉 inbox → 每日循環~~ ✅ 0726：0046 capture_inbox + /capture 頁 + API（source 支援 yukiboard/agent）
- [x] ~~更多 widget：focus_timer / creative_streak / mood_checkin / goal_tracker / on-this-day~~
      ✅ 0726：四個新 widget（0045 mood_entries+goals）＋ on_this_day 本就可用；sync-widget-defs.ts
- [ ] Email 週報 channel、協作/訪客分享、公開作品集頁（`feature.publicPortfolio` flag 已在）
- [x] ~~（embedding）記憶語意搜尋~~ ✅ 0726：/api/memories/search + match_memories RPC（跨產品跨庫版待平台整合）
- [ ] **富文本輸入（tiptap + emoji + giphy）** — 全站輸入框（Agent 對話、筆記、捕捉、留言等）
      升級為 tiptap 編輯器 + 表情選擇器 + giphy GIF 挑選。**參考 AI 島 `D:\SnowRealmRebirth\AI\ai_island_v3`**
      的實作。注意：giphy 需 API 金鑰（外部資源）、儲存格式需相容既有純文字/blocks 欄位。
- [ ] 對話歷史摘要（長對話壓縮，接 ai-core，可用 groq 免費驗）— 同 D 區重複，收尾 AI Core 用
- [ ] （跨產品）寵物版 Space

### 平台/經濟（Bucket 3，多為「等決策」非「等程式」）
- [ ] Trust Level（見 C）／AI Dot 帳本（見 D）／Z幣錢包（卡金流·稅）／SnowRealm+ entitlement 服務／
      Onboarding Dot 獎勵＋任務引擎／ai-core 抽成共用 HTTP AI Router（卡 SSO issuer 決策）

---

## 0726 續（下半場完成清單）

- [x] ~~公開作品集頁 + unlisted + 分享連結~~ ✅ 每作品 private/unlisted/public（0048）、anon RLS（0049，零洩漏實測）、`/p /w`、share_links（0050）`/s` 唯讀+到期+撤銷
- [x] ~~Email 週報（Resend）~~ ✅ 0047 opt-in + worker email helper（待 Luffy 設 RESEND_API_KEY）
- [x] ~~隨手記 CRUD + /notes~~ ✅ notes CRUD API + 頁 + widget 改多則
- [x] ~~帳號匯出 ZIP~~ ✅ fflate（data.json+assets.csv+README）
- [x] ~~基礎設施：lefthook / Sentry-lite / CI-Zeabur~~ ✅（CI 早已完成；Sentry 待 DSN）
- [x] ~~背景場景/Lottie 即時預覽格~~ ✅ 取代文字選單
- [x] ~~平台身份 prep（ADR-024）~~ ✅ identity 介面 + `profiles.snowrealm_id`（0051）+ ADR + platform.md 看法
- [x] ~~全專案接線審計~~ ✅ API↔DB 全清；UI↔後端修 Theme 匯出；RWD 修 2 處
- [x] ~~UI bug：幻燈片命名 / 側邊欄 sticky / Theme 手機預覽 sticky~~ ✅

### 仍待（外部/決策）
- [ ] 開 `snowrealm-id` 專案 → Space 接 OIDC client + 綁定/解綁流程（ADR-024 已備）
- [ ] Zeabur env：RESEND_API_KEY / RESEND_FROM / SENTRY_DSN
- [ ] 字體檔、Figma 憑證、AI Dot 定價、visual regression（與 E2E 暫停衝突，待解除）

---

# 🔴 你（Luffy）要做的事 — 詳細步驟（0727 整理）

> 這一節是最下面的「操作手冊」：每項都寫清楚**在哪做、貼哪、為什麼**。上面的 🅰 區是摘要，這裡是步驟。
> 正式網域以 `https://snowrealm-space.snowrealm.pet` 為例（換成你的實際網域）。
> Zeabur env 改法：Zeabur 專案 → 該服務 → Variables → 加/改 → **Redeploy** 才生效。

## 0. Zeabur 重新部署（最優先，每次改完都要）
- push 會自動觸發；若沒觸發或想立即看到今天的改動：Zeabur → web 服務 → **Redeploy（抓最新 commit）**。
- **build 綠 ≠ 起得起來**：部署後點進網站確認首頁能開、CSS 有載入（不是純文字排版）。

## 1. AI 金鑰（Groq + Gemini，免費）→ 貼在後台，不放 env
1. Groq：<https://console.groq.com/keys> 申請 → 複製 `gsk_...`
2. Gemini：<https://aistudio.google.com/apikey> 申請 → 複製
3. 進網站 **後台 → AI 金鑰（`/admin/ai-keys`）** → 各家貼上（會先測試才加密存 DB）。
4. Zeabur web 只需設**一把** `AI_KEY_ENCRYPTION_SECRET`（base64 的 32 bytes）：
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` 產生後貼進 Zeabur env。
5. 設好 Groq+Gemini，Agent 對話 / 主題配色 / 記憶檢索 / 洞察就會真的產生回應。
   （後台 Secret 產生器 `/admin/secrets` 也能產這把金鑰。）

## 2. Email（Resend）→ magic link / 週報 才對外可用
> 帳號密碼登入不受影響；這只影響「寄信」。
1. Resend：<https://resend.com> 註冊 → **Domains** 加你的網域 → 照它給的 DNS（SPF/DKIM）設好 → 驗證通過。
2. API Keys → 建一把 → 複製 `re_...`。
3. Zeabur web env：`RESEND_API_KEY=re_...`、`RESEND_FROM=service@snowrealm.pet`（用已驗證網域的寄件人）。
4. **Supabase Auth 寄件人**：把 auth 服務的 `GOTRUE_SMTP_ADMIN_EMAIL` 設成 `service@snowrealm.pet` → 重啟 auth。
   （目前 `Error sending confirmation email` 就是寄件人還在沙盒。）

## 3. Google 登入
1. <https://console.cloud.google.com> → 建專案 → **OAuth consent screen**（外部）填好、加測試使用者。
2. **Credentials → Create OAuth client ID → Web application**。
3. **Authorized redirect URI** 填 Supabase 的 callback（Supabase Dashboard → Auth → Providers → Google 會顯示那個 URL，長得像 `https://<專案>.supabase.co/auth/v1/callback`）。
4. 拿到 Client ID / Secret：
   - Zeabur web env：`GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`
   - **Supabase Dashboard → Auth → Providers → Google → 開啟 + 貼上同一組**（兩邊都要設才生效）。
5. 沒設的話登入頁 Google 按鈕會顯示「尚未設定」並停用，不會壞。

## 4. LINE 登入
1. <https://developers.line.biz/console/> → 建 Provider → 建 **LINE Login** channel。
2. **Callback URL** 填 `https://snowrealm-space.snowrealm.pet/api/auth/line/callback`
   —— **必須與這裡完全一致**，多一個斜線就會被拒且不告訴你原因。
3. Zeabur web env：`LINE_LOGIN_CHANNEL_ID` / `LINE_LOGIN_CHANNEL_SECRET` / `LINE_LOGIN_REDIRECT_URI`（=上面那個 callback）。
4. 想拿 email：在 channel 申請 **email 權限**（要填用途說明）。
5. LINE 走自建流程（Supabase 不支援），程式已完成，只差憑證。

## 5. Figma（Milestone F）
1. <https://www.figma.com/developers/apps> → Create new app → 拿 **Client ID / Client Secret**。
2. OAuth redirect 用正式網域的 callback。
3. `FIGMA_WEBHOOK_SECRET` **不是 Figma 發的**——是你自訂的 passcode：
   `openssl rand -hex 32` 產一個，之後建 webhook（`POST /v2/webhooks`）時填這個字串，Figma 會原樣回傳在每則事件，我們用它驗證。
4. Zeabur web env：`FIGMA_CLIENT_ID` / `FIGMA_CLIENT_SECRET` / `FIGMA_WEBHOOK_SECRET`。

## 5b. Canva（設計來源，跟 Figma 同性質：讀取＋分析設計）
1. <https://www.canva.com/developers/> → Create an app（Canva Connect API）→ 拿 **Client ID / Client Secret**。
2. 設定 **OAuth redirect URL** 為正式網域 callback、勾選需要的 scopes（讀設計 `design:content:read`、資產 `asset:read` 等）。
3. Zeabur web env：`CANVA_CLIENT_ID` / `CANVA_CLIENT_SECRET`（+ 若有 webhook 再加 secret）。
4. 程式面：provider-core 已註冊 Canva capabilities（未設憑證前顯示「尚未設定」、不給假按鈕）；
   憑證設好後才實作 OAuth connect/callback 與 `canva.sync`（同 Figma 路徑）。

## 6. 隱私政策 / 使用條款（Google、LINE 審核前置）
- `/privacy`、`/terms` 頁面已存在；送 Google/LINE 審核前，**確認內容寫實**（資料怎麼用、第三方登入、刪除方式）。

## 7. JWT secret（正式對外前必換）
- Zeabur 的 Supabase 還在用 demo 預設 secret（key 的 `iss=supabase-demo`）。
- 換成自己的 JWT secret → **重新產生 anon / service key** → 更新所有用到的 env。正式對外前一定要做。

## 8. 字體
- **拉丁字體（Inter/Playfair/…）**：後台 **字體管理（`/admin/fonts`）→ 選字體 → 「⤓ 自動安裝」** 很快，直接用。
- **中文字體（思源黑/宋、昭源…）** ✅ 0727：**自動安裝已移到 worker 背景 job**（無 HTTP timeout），
  中文全字重也能免 CLI、不再 524。後台「⤓ 自動安裝」入列後會輪詢，字體約 1–3 分鐘自己出現在「已安裝」。
  - 🔴 **前置**：這次動到 worker → **Zeabur 的 worker 服務也要重新部署**（才認得 `font.install` 佇列）。
- **台北黑體**（無自動來源）：翰字鑄造 <https://sites.google.com/view/jtfoundry/> 下載 3 個字重 + OFL 授權 → 後台上傳；檔案大時單一字重分次上傳。詳見 `docs/fonts/README.md`。

> ~~**待做**：字體安裝移 worker 背景 job~~ ✅ **0727 完成**（handler `font.install` + install route 只入列 + UI 輪詢）。

## 9. Giphy（富文本 GIF）—— ✅ 你已設好
- 已在 env/Zeabur 設好。代理 `/api/giphy` 讀 `GIPHY_API_KEY` 或 `NEXT_PUBLIC_GIPHY_API_KEY` 皆可。

## 10. Sentry（可選，錯誤監控）
- <https://sentry.io> 建專案 → 拿 DSN → Zeabur web env `SENTRY_DSN`。沒設就是關閉（no-op），不影響運作。

## 11. 只有你能決定的內容
- **Agent 名字 / 外觀**（Milestone D 前）。
- **生日鏈第 5 環「一年後」放什麼**（已有 AI 代寫版，可換）。
- **正式產品名稱**（公開前；程式用 `snowrealm` 前綴、品牌走 i18n）。
- **AI Dot 定價表**（卡經濟層帳本）。

## 12. 平台（之後，見 docs/SnowRealm-Platform-*.md）
- 開 `snowrealm-id`（OIDC issuer）→ Space 接 client + 綁定/解綁（ADR-024 已備）。
- 抽 `@snowrealm/rich-editor` SDK（見 `SnowRealm-SDK-vs-Platform.md`）。
