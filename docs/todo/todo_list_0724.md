# SnowRealm Space 待辦總表（2026-07-24 · 現行主檔）

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
| D — AI Core | 🚧 大幅完成 | 路由層+對話+工具+記憶全備（113 ai-core 測試）；剩對話產生回應需金鑰、vision/串流 |
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
- 🔴 **Cloudflare R2** — 建 private bucket `snowrealmspace`、建 R2 API Token，
      在 web 服務設 `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET`，
      `R2_REGION=auto`、**移除** `R2_FORCE_PATH_STYLE`、`R2_ENDPOINT` 留空。設好上傳/背景圖才會通。
- 🔴 **R2 bucket CORS**（否則上傳一律「網路中斷」）— 瀏覽器直傳 R2 是跨網域，bucket 要設 CORS。
      到 Cloudflare → R2 → bucket `snowrealmspace` → Settings → CORS policy 貼上允許
      `https://snowrealm-space.snowrealm.pet` + `http://localhost:3000` 的 PUT/GET/HEAD、Expose ETag
      （`pnpm tsx scripts/setup-r2-cors.ts` 會印出可直接貼的 JSON；用 Admin token 則能自動寫入）。
- 🔴 **部署 worker 服務** — `apps/worker/Dockerfile`，不可休眠。沒它背景圖處理、排程 GC 不會跑（`/api/health` 的 queue 會是紅的）。
- 🔴 **JWT secret** — Zeabur Supabase 仍用 demo 預設 secret（key 的 iss=supabase-demo）。**正式對外前必換**，換完重新產 anon/service key 更新 env。
- 🔴 **Q10 手動走查** — 人實際點過 Milestone B 一輪（主題/背景/字體/版面）。
- 🔴 **台北黑體字檔** — 沒有穩定下載網址，需人工下載放 `assets/fonts/taipei-sans-tc/`（其餘 12 套已自動化）。
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
- [ ] Sentry / 監控（`queue-health` 目前只 log，沒告警管道）
- [ ] `/api/health` 全綠（等 R2 + worker）
- [ ] preview 與 production 用不同 Supabase / R2 bucket
- [ ] preview 不設付費 AI 金鑰 → 自動全走免費模型，PR 不產生帳單
- [ ] Next `output: 'standalone'`（縮小映像檔，首次部署以正確性優先，之後再開）
- [ ] lefthook git hooks
- [ ] 小技術債（0723 沿用）：`packages/db` 未列規格 §53（已記 build log）、migration 編號與規格 §0 規劃不同（按 Milestone 順序建立）
- [ ] E2E/a11y 在 CI 一直 churn — Luffy 要求暫停跑；日後要重新穩定（gate 全域 setup、
      環境對齊）再開。目前改靠 typecheck/單元/RLS/直連 DB 驗證。

---

## 🅱 Milestone B — 剩餘

- [x] ~~字體系統：13 套字體、分片、選擇 UI、SSR 注入、字體配對~~
- [x] ~~影片時長雙層檢查、三種轉場、輪播、時段排程 UI~~
- [x] ~~Widget 設定面板（自動生成）、隱藏、鎖定、版面切換~~
- [x] ~~毛玻璃數量上限、視覺回歸（opt-in）~~
- [ ] Layout preset 多套版面切換的**進階**（目前可新增/切換/改名/刪除，夠用）
- [ ] poster frame 抽取（需 ffmpeg，排到 C）
- [ ] Visual regression 基準擴充到更多頁

---

## 🛠 站台管理後台（`/admin/*`，站台管理員身份）

> 照 ai 島架構逐步擴充。身份走 `lib/auth/site-admin`（多 signal）。已完成：AI 金鑰管理。

**AI 管理**（表都建好了）
- [x] ~~AI 金鑰管理 `/admin/ai-keys`（各家加密存 DB、測試、啟用/移除）~~
- [ ] **AI 模型管理** `/admin/ai/models`（ai_models CRUD：啟用/停用、成本、vision/tools 標記、新增退役）
- [ ] **候選鏈管理** `/admin/ai/usage-models`（每個 usage key 的候選鏈與順序、role 調整）
- [x] ~~**AI 用量／成本儀表板** `/admin/ai/usage`（總成本、免費vs付費、escalate/fallback/degraded/cache 率、依 provider/usage 拆分）~~
- [ ] **每日額度設定**（免費/付費上限，目前寫死 300/20）
- [ ] **回應快取** `/admin/ai/cache`（命中率、清空、per-usage）
- [ ] **內容審核關鍵字**（FORBIDDEN_PATTERNS 可後台編輯）

**系統／營運**
- [ ] **Feature flags 管理**（全站/ per-space 開關，目前只能改 DB）
- [ ] **系統健康儀表板**（queue health、job_records、storage 用量、/api/health 匯總、cron 上次執行）
- [ ] **稽核日誌檢視** `/admin/audit`（audit_logs 篩選/搜尋）
- [ ] **Agent 動作檢視** `/admin/agent-actions`（待確認、已執行、可 undo 的清單）
- [ ] **站台管理員角色**（目前靠 env allowlist；可加 DB role 授予/撤銷，如 ai 島 owner/admin/support）
- [ ] **整合/webhook 狀態**（provider_webhooks 收件記錄、connection 健康）

**內容／空間**
- [ ] **內容池管理**（content_items 檢視/新增/審核每日內容、生日鏈編輯）
- [ ] **Space/使用者管理**（列出 spaces、佈建狀態、用量、孤兒帳號修復）

## 🅕 Milestone F — Integration（骨架起）

- [x] ~~`@snowrealm/provider-core`：ProviderCapabilities（前端只顯示支援、禁 Coming Soon）、
      DesignProviderAdapter 介面、FigmaAdapter、HMAC 簽章驗證、webhook 冪等（12 測試）~~
- [x] ~~GET /api/integrations（capability matrix）+ POST /api/webhooks/:provider（驗簽+冪等+快回 200）~~
- [x] ~~middleware 豁免 /api/webhooks/*（外部呼叫）~~
- [ ] 🔴 **Figma app 憑證**（client id/secret）→ OAuth connect/callback、figma.sync job 才能實作
- [ ] 🔴 worker 部署（sync job 要跑）

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
- [ ] Insight 升級 inference/suggestion/creative（需 D 的 LLM，即金鑰）

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
- [ ] SSE 串流、UI 五分類視覺區別（文字對話已可用，串流待金鑰調校）
- [ ] 設計分析 light/deep（vision，需金鑰）；把 Insight/greeting 接 completeForUsage（graceful）
- [ ] embedding 記憶語意檢索 + 對話歷史摘要（需金鑰）

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

## 深淺色切換（🆕 Luffy 0724 提出）

- [x] ~~**明/暗模式切換（選項 A）** — deriveDarkTheme 為任何主題自動算暗色版
      （保留色相個性、確保 4.5 對比）、nav 日/月鈕、cookie 記住、SSR 不閃、切換 <150ms~~

---

## 技術債

- [ ] `--sr-font-*-id` 舊註解（已解，可清）
- [ ] widget config 的 uuid 型欄位（projectId）需專門選擇器（目前標 unsupported 跳過）
- [ ] `apps/web/lib` 部分邏輯無單元測試（靠 E2E）
- [ ] `QuickNoteWidget` 存 localStorage（Milestone C 有 notes 表後遷移）
- [ ] 測試 env 指向 hosted 會污染正式資料 — 已有 cleanup 腳本，但流程要小心
- [ ] Insight 軟刪除後，下次 `generateInsights` 的 upsert 會更新到同一列但 `deleted_at` 仍在
      → 被刪的回顧不會自動復活（可接受；若要「刪了就不再出現該週期」則需在 upsert 前濾掉）
- [ ] 主動訊息目前「進 Home 時觸發」；完整方案要 cron 掃時區主動產生（同每日卡片）
- [ ] `apps/web/lib/insights`、`lib/daily/proactive`、`lib/notifications` 尚無單元測試
      （引擎邏輯已用 `scripts/verify-milestone-e.ts` 直連 DB 驗證，但缺純函式單測）
