# 待辦總表

> 建立於 2026-07-23。
>
> **這份是唯一的完整清單** —— 功能、基礎設施、被外部資源卡住的項目全在這裡。
>
> **規則：完成的項目用 ~~刪除線~~ 保留，不要刪掉。**
> 保留的目的是能回頭看到「這件事做過、什麼時候做的」，
> 刪掉會讓清單看起來一直沒進展，也失去追溯能力。
>
> 每完成一項：畫線 → 在 `docs/spec/90-build-log.md` 補一行。
> 里程碑層級的完成度總覽在 `docs/spec/91-backlog.md`。

---

## 進度總覽

| Milestone | 狀態 | 完成度 |
|---|---|---|
| A — Foundation | ✅ 完成 | 100% |
| B — Visual Personalization | 🚧 進行中 | 約 75% |
| C — Creative Core | ⬜ 未開始 | 0% |
| D — AI Core | ⬜ 未開始 | 0% |
| E — Daily Loop | ⬜ 未開始 | 0% |
| F — Integration | ⬜ 未開始 | 0% |
| 跨里程碑：隱私與刪除 | 🚧 部分 | 約 40% |
| 基礎設施 / 部署 | 🚧 進行中 | 約 70% |

**Birthday Alpha ＝ A–E 全數通過。** 目前在第二個里程碑後段。
剩餘工作量粗估是已完成部分的 3–4 倍，D（AI Core）是單一最大的一塊。

---

# 一、功能待辦

## Milestone A — Foundation ✅

- [x] ~~monorepo（pnpm workspace + Turborepo）、嚴格 TypeScript~~
- [x] ~~Supabase Auth magic link + PKCE~~
- [x] ~~邀請制閘門（ADR-003）、space 佈建~~
- [x] ~~多租戶 RLS（`is_space_member` / `is_space_owner`）~~
- [x] ~~`activity_events` / `audit_logs`~~
- [x] ~~feature flags、pg-boss 佇列骨架~~
- [x] ~~`/api/health` 三項檢查~~
- [x] ~~CI workflow 5 個 job、check:secrets、check:rls、dependency-cruiser~~

## Milestone B — Visual Personalization 🚧

### B0. 已完成

- [x] ~~第三方登入綁定（Google / LINE）—— 原規劃在 V1，提前完成~~
- [x] ~~Font System：13 套字體、分片、選擇 UI、SSR 注入（B1）~~
- [x] ~~影片時長雙層檢查、三種轉場、輪播、時段排程（B2/B3）~~
- [x] ~~Widget 設定面板（自動生成）、隱藏 / 鎖定（B3）~~
- [x] ~~Asset 上傳（直傳 R2、presigned PUT、配額檢查）~~
- [x] ~~Asset 處理 job（sharp、rendition、取色）~~
- [x] ~~Theme Studio：調色盤、對比檢查、即時預覽~~
- [x] ~~主題匯入 / 匯出（含 RFC 5987 中文檔名）~~
- [x] ~~4 套內建主題 preset~~
- [x] ~~CIELAB k-means 取色（決定性、固定 seed）~~
- [x] ~~WCAG 2.2 AA 對比計算（半透明前景先合成）~~
- [x] ~~背景設定：單張 / 播放清單 / 排程 resolver~~
- [x] ~~Widget 網格：碰撞下推、重力壓實、reflow 重排~~
- [x] ~~播放清單拖拉排序~~
- [x] ~~Q1–Q9 品質閘門（含 51 項 E2E、axe-core 無障礙）~~

### B1. Font System ✅ 完成

- [x] ~~13 套 OFL 字體（繁中 9 + 拉丁 5，全部開源可商用）~~
- [x] ~~`scripts/download-fonts.ts`（Google Fonts / GitHub release / 分支 / zip）~~
- [x] ~~`scripts/build-fonts.ts` 分片腳本（可變字體先固定字重）~~
- [x] ~~繁中 unicode-range 分片（依字頻挑 240 常用字 + 45 碼位片）~~
- [x] ~~`fonts` / `font_pairs` seed（`scripts/upload-fonts.ts`，1123 片上傳 R2）~~
- [x] ~~字體選擇 UI（Theme Studio 的 FontPanel）~~
- [x] ~~6 組字體配對建議~~
- [x] ~~首屏預算檢查（建置時強制，實測後改為中文 90KB / 拉丁 80KB）~~
- [x] ~~換主題時卸載未使用的 `@font-face`（diffFontUsage）~~
- [x] ~~`--sr-font-*-id` → `font-family` 解析（SSR 注入 + 客戶端載入）~~
- [ ] 台北黑體要人工下載（沒有穩定下載網址）——其餘 12 套已自動化

### B2. 影片背景（ADR-019）

- [x] ~~`feature.videoBackground` flag（預設關閉）~~
- [x] ~~檔案大小限制（20 MB）~~
- [x] ~~reduced-motion 降級邏輯~~
- [x] ~~影片暫停控制~~
- [x] ~~時長檢查（30 秒，前端 <video> + worker 讀容器標頭雙層）~~
- [ ] poster frame 抽取（需 ffmpeg；排到 Milestone C 一起）
- [x] ~~E2E 驗證（video-metadata parser 19 項單元測試）~~

### B3. Theme / Background 補漏

- [x] ~~`time_of_day` 排程設定 UI（ScheduleEditor，重疊即時擋下）~~
- [x] ~~`per_login` / `hourly` / `sequential` 前端計時輪播~~
- [x] ~~blur_fade / zoom_fade 轉場動畫~~
- [x] ~~Widget config 編輯面板（從 zod schema 自動生成）~~
- [x] ~~Widget 隱藏 / 鎖定的 UI~~
- [x] ~~Layout preset 多套版面切換（切換器 + 新增/改名/刪除，載入使用中版面）~~
- [x] ~~毛玻璃數量上限（桌機 12 / 手機 6，IntersectionObserver 優先保留視窗內）~~
- [x] ~~Visual regression 測試（opt-in @visual，不進主 CI，已 mutation 驗證會失敗）~~

### B4. 品質閘門

- [x] ~~Q1–Q9~~
- [ ] **Q10 手動走一次完整閉環** —— 需要人實際操作一遍

## Milestone C — Creative Core ⬜

閉環：建立專案 → 上傳作品 → 設為背景 → 一鍵生成主題並套用。**無外部阻塞，可直接開始。**

- [ ] Project CRUD、狀態、封面、tag、活動時間
- [ ] `design_files` + `design_snapshots` 建表與 API
- [ ] Library 篩選、pg_trgm 搜尋
- [ ] Asset actions（13 種）
- [ ] 軟刪除 + 30 天寬限 + `asset.purge` job
- [ ] 版本比較：並排 / 疊圖 / 滑桿三種模式
- [ ] Timeline：`event.project` job、投影規則、節流、四種檢視
- [ ] 本地分析擴充：對比檢查、留白比例、textZoneLuminance（目前只有取色）

## Milestone D — AI Core ⬜（最大的一塊）

**相依：** 至少兩把免費 AI 金鑰。

- [ ] `packages/ai-core`：providers（三種協定 / 九家）、router、resolve-usage、cache、keys
- [ ] 斷路器、低信心偵測、候選鏈升級
- [ ] `ai_usage_log`、免費/付費分開計、degraded 降級
- [ ] Agent system prompt、context builder、SSE 串流
- [ ] 五分類（Fact / Metric / Inference / Suggestion / Creative）+ `clampStatement` 後處理
- [ ] 10 個 tool：JSON schema、權限、確認策略、undo
- [ ] Memory：提案 → 批准流程、pgvector 檢索、Memory Center
- [ ] 設計分析：light（免費 vision）/ deep（付費）兩條路徑

## Milestone E — Daily Loop ⬜

**相依：** 內容與生日信必須由人撰寫，不可由 AI 生成（`09-content-pool.md`）。

- [ ] 內容池：60 quote + 80 prompt + 30 greeting + 各級 surprise（**人工撰寫**）
- [ ] 生成：cron 掃時區、冪等、選取演算法、三段降級鏈
- [ ] Surprise：稀有度機率、rare 保底計數器、機率公開頁
- [ ] 生日鏈：`availableFrom` 條件觸發（**生日信人工撰寫**）
- [ ] 主動訊息：觸發條件、頻率上限、`FORBIDDEN_PATTERNS` 攔截
- [ ] Insight：至少 3 種類型、evidence + confidence
- [ ] Notification：in-app、分類、Quiet hours

## Milestone F — Integration ⬜

**相依：** Figma app 憑證 + 正式網域。

- [ ] Figma OAuth、capability matrix
- [ ] webhook 冪等
- [ ] 同步 job、斷線資料處理

## 跨里程碑：隱私與刪除

> `10-acceptance.md` 要求**這一組必須在 Milestone C 結束前完成**。
> 刪除流程若最後才做，會發現前面所有功能都沒考慮 cascade。

- [x] ~~刪除單一 asset（含引用檢查）~~
- [x] ~~刪除主題 / 背景 / 播放清單~~
- [x] ~~`storage.gc`：逾期上傳與軟刪除滿 30 天的清除~~
- [ ] 刪除 design snapshot（Milestone C）
- [ ] 刪除 memory（Milestone D）
- [ ] 中斷 provider + 刪除派生資料（Milestone F）
- [ ] **刪除 space（7 天寬限、R2 先於 DB）**
- [ ] **刪除帳號**
- [ ] **帳號匯出（zip）**
- [ ] AI 資料聲明頁
- [ ] 資料地圖頁

---

# 二、基礎設施

- [x] ~~git init + GitHub remote（`luffysky/snowrealmspace`）~~
- [x] ~~Dockerfile：`apps/web`、`apps/worker`（build context ＝ repo 根目錄）~~
- [x] ~~`.dockerignore`（排除 `.env.local`，不進映像檔）~~
- [x] ~~Cron 機制改為 pg-boss `schedule()`（ADR-008，`apps/worker/src/schedules.ts`）~~
- [x] ~~`queue-health` 檢查（每 5 分鐘）~~
- [x] ~~`storage.gc`（每日 03:00 UTC）~~
- [x] ~~部署手冊 `docs/spec/14-deploy-zeabur.md`~~
- [x] ~~移除 CI 的 Vercel 假設~~
- [x] ~~e2e job 啟動 worker（沒有它 asset.process 不會跑，theme 測試必失敗）~~
- [x] ~~`worker` job 併進 `database` job（少一次 2–4 分鐘的 supabase start）~~
- [ ] **CI 全綠** —— 修正已推送，等 run 結果
- [ ] Sentry / 監控（`queue-health` 目前只 log，沒有告警管道）
- [ ] lefthook git hooks
- [ ] Next `output: 'standalone'`（縮小映像檔，首次部署以正確性優先）
- [ ] Visual regression

---

# 三、被外部資源卡住

## 🔴 P0 — 阻塞 Milestone B 完成

### 1. 字體檔案（ADR-016）

**需要下載並放進 `assets/fonts/`（原始 TTF/OTF）：**

| # | 家族 | 來源 | 用途 |
|---|---|---|---|
| 1 | Noto Sans TC | Google Fonts | UI 預設 / 內文 |
| 2 | Source Han Sans TC（思源黑體） | Adobe / Google | 內文替代 |
| 3 | Noto Serif TC | Google Fonts | 中文標題 |
| 4 | LXGW WenKai TC（霞鶩文楷） | GitHub lxgw/LxgwWenKai-TC | 柔和 / 手寫感 |
| 5 | Inter | rsms.me/inter | 英文 UI |
| 6 | Playfair Display | Google Fonts | 英文標題 |
| 7 | Cormorant Garamond | Google Fonts | 英文襯線 |
| 8 | JetBrains Mono | JetBrains | 等寬 |

全部為 OFL 1.1。**每一套都要一併保存 `OFL.txt`**（授權要求，
且 `fonts.license_file_key` 欄位要指向它）。

> ⚠️ 繁中字體單檔 6–9 MB，**不要 commit 進 git**。
> 放 `assets/fonts/`（已在 .gitignore），分片產物上傳 R2。

> 📌 使用者要求「多找些繁中、全部開源可商用」—— 這份清單要擴充，尚未做。

## 🟡 P1 — 阻塞首次部署

### 2. ~~Git repository~~ ✅

- [x] ~~`git init` + 首個 commit~~
- [x] ~~remote：`https://github.com/luffysky/snowrealmspace.git`~~
- [ ] CI 綠燈

### 3. Hosted Supabase

- [ ] 建立 Supabase 專案（region 建議 `Northeast Asia (Tokyo)`）
- [ ] 取得 `DATABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `pnpm db:migrate`（已在本機驗證冪等與 reset）
- [ ] `pnpm db:seed` —— **不可略過**，`widget_definitions` 沒資料會讓所有 widget 建立失敗
- [ ] **Authentication → URL Configuration**：Site URL + `https://<網域>/**`

> 沒設 redirect allowlist 時，Supabase 會**靜默退回 site_url
> 並從 PKCE 降級成 implicit flow**，沒有明顯錯誤訊息。實際踩過。

### 4. Cloudflare R2

- [ ] 建立 bucket（**private**）
- [ ] API token（Object Read & Write）
- [ ] `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET`
- [ ] production **不要**設 `R2_ENDPOINT`（留空才會用真正的 R2）
- [ ] CORS：允許正式網域的 PUT（直傳需要）

### 5. Zeabur（ADR-008）

步驟見 `docs/spec/14-deploy-zeabur.md`。

- [ ] 建立 Zeabur 專案
- [ ] 部署 Supabase 模板
- [ ] `apps/web` 服務（Dockerfile `apps/web/Dockerfile`，context 根目錄，port 8080）
- [ ] `apps/worker` 服務（**不可休眠** —— 休眠會讓 pg-boss 排程斷掉）
- [ ] `DATABASE_URL` 用內網位址
- [ ] preview 與 production 用**不同的** Supabase 與 R2 bucket
- [ ] preview **不要設 `ANTHROPIC_API_KEY`** → 自動全走免費模型，PR 不會產生帳單

**建好帳號後要確認的：**
- [ ] Supabase 模板包含哪些服務
- [ ] worker 的休眠策略
- [ ] 建置記憶體上限（sharp + Next build 較吃資源）
- [ ] 是否支援 PR preview environment

## 🟢 P2 — 之後才需要

### 6. AI Provider 金鑰（Milestone D）

ADR-023 免費優先。**只要兩把免費金鑰就能開發**，建議 Groq + Google。

| Provider | 申請 | 免費額度（撰稿時） |
|---|---|---|
| Groq | console.groq.com | 免費層，延遲最低 |
| Google Gemini | aistudio.google.com | Flash 系列，**免費層中唯一可靠的 vision** |
| Cerebras | cloud.cerebras.ai | ~1M tokens/日 |
| Mistral | console.mistral.ai | Experiment 層 ~1B tokens/月 |
| SambaNova | cloud.sambanova.ai | 免費額度 |
| OpenRouter | openrouter.ai | `:free` 後綴模型，可當保底 |
| Anthropic（付費） | console.anthropic.com | 只在升級路徑用，開發時可留空 |

> 不採用 GitHub Models —— AI 島程式碼註記其於 2026-07-30 退役。

### 7. Google / LINE 登入 —— 程式碼已完成，只差憑證

規劃見 `docs/spec/13-third-party-auth.md`。**綁定與登入的程式碼全部寫完了**，
沒設憑證時按鈕會停用並說明原因，不是壞掉。

- [x] ~~`user_identities` + `oauth_transactions` migration（0013）~~
- [x] ~~`/settings/account` 綁定 / 解綁介面~~
- [x] ~~「至少保留一種登入方式」保護（UI 停用 + API 409，兩層都有測試）~~
- [x] ~~Google 綁定（Supabase `linkIdentity`）與登入~~
- [x] ~~LINE 自建 OAuth：state / nonce / id_token 驗證~~
- [x] ~~跨使用者 RLS 隔離測試（5 項）~~
- [x] ~~E2E 7 項（桌機 + 行動版都綠）~~

**還缺的（需要你做）：**

- [ ] 隱私權政策頁（兩家審核前置）
- [ ] Google Cloud Console → OAuth consent screen + Client ID
      → `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`
      → 另外要在 Supabase Dashboard → Authentication → Providers 也開啟
- [ ] LINE Login channel（callback URL 要**完全一致**，多一個斜線就失敗）
      → `LINE_LOGIN_CHANNEL_ID` / `LINE_LOGIN_CHANNEL_SECRET` / `LINE_LOGIN_REDIRECT_URI`
- [ ] LINE email 權限申請（需說明用途，且使用者可拒絕）
- [ ] LINE 通知 channel（V2，複用登入時取得的 `line_user_id`）

### 8. Figma OAuth（Milestone F）

- [ ] Figma Developers 建立 app
- [ ] `FIGMA_CLIENT_ID` / `FIGMA_CLIENT_SECRET` / `FIGMA_WEBHOOK_SECRET`
- [ ] Redirect URI 需正式網域

---

# 四、需要你決定的（不阻塞，但有時點）

| 問題 | 最晚何時 | 現況 |
|---|---|---|
| Agent 的名字與外觀 | Milestone D 開始前 | `agent_profiles` 已預留欄位 |
| 生日信內容 | Milestone E 前 | `content/letters/birthday-letter.md`，**人寫不由 AI 生成** |
| 生日鏈第 5 環「一年後」放什麼 | Milestone E 前 | 結構已預留 |
| 是否加背景音樂 | V1 | 獨立 widget |
| 正式產品名稱 | 公開發布前 | 程式碼用 `snowrealm` 前綴，品牌走 i18n |

---

# 五、需要你做的事（我做不了）

| 項目 | 何時 |
|---|---|
| 下載 8 套字體檔 | Milestone B 完成前 |
| 建立 Zeabur 專案與 Supabase | 首次部署前 |
| 建立 Cloudflare R2 bucket | 首次部署前 |
| 申請 Google OAuth Client / LINE Login channel | 第三方登入上線前 |
| 申請免費 AI 金鑰（至少 2 把） | Milestone D 前 |
| 撰寫 Daily / Surprise 內容池 | Milestone E |
| **撰寫生日信** | Milestone E |
| 決定 Agent 名稱與外觀 | Milestone D 前 |
| 手動走一次 Milestone B 閉環（Q10） | B 收尾前 |

---

# 六、技術債（我自己欠的）

| 項目 | 說明 | 何時還 |
|---|---|---|
| `--sr-font-*-id` 沒解析成 font-family | 見 B1 最後一項 | Font System 一起 |
| widget config 沒有 UI | schema 完備但使用者改不了 | B3 |
| `apps/web/lib` 沒有單元測試 | 覆蓋率只算 `packages/*`；`background-resolver` 等靠 E2E 涵蓋 | Milestone C |
| `QuickNoteWidget` 存 localStorage | Milestone C 有 notes 表後遷移；UI 已明說「只存這台裝置」 | Milestone C |
| `packages/db` 未列在規格 §53 | 已記在 build log，規格本身未更新 | Milestone B 結束時 |
| migration 編號與規格 §0 規劃不同 | 實際按 Milestone 順序建立 | 同上 |
