# 待辦 — 被外部資源卡住的項目

> 建立於 2026-07-23。最後更新 2026-07-23（部署平台改為 Zeabur）。
>
> **這份只記「被外部資源卡住」的項目。**
> 完整的剩餘工作盤點在 `docs/spec/91-backlog.md`。
>
> 完成一項就從這裡移除，並在 `docs/spec/90-build-log.md` 補一行。

---

## 🔴 P0 — 阻塞 Milestone B 完成

### 1. 字體檔案（ADR-016）

Milestone B 要做 Font System，但**我們手上沒有任何字體檔**。

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

**全部為 OFL 1.1。每一套都要一併保存 `OFL.txt`**（授權要求，且 `fonts.license_file_key` 欄位要指向它）。

**我可以做的：** `scripts/build-fonts.ts` 分片腳本、`fonts` 表 seed、載入策略、`@font-face` 產生器。
**卡住的部分：** 實際的字型檔。可以用 `pnpm exec tsx scripts/download-fonts.ts`（待寫）自動抓 Google Fonts 的部分，但思源黑體與霞鶩文楷需要手動下載。

> ⚠️ 繁中字體單檔 6–9 MB，**不要直接 commit 進 git**。放 `assets/fonts/`（已在 .gitignore），分片產物上傳 R2。

---

## 🟡 P1 — 阻塞首次部署

### 2. Git repository

CI workflow（`.github/workflows/ci.yml`）已寫好 5 個 job，但**從未實際執行過**。

**需要：**
- [ ] `git init` + 首個 commit（我可以代做）
- [ ] 建立 remote（GitHub）
- [ ] push 後確認 CI 綠燈

**首次跑 CI 要注意的：**
- `supabase start` 在 GitHub runner 上約需 2–4 分鐘，`database` / `e2e` / `worker` 三個 job 各要跑一次
- 若太慢，可考慮把三個 job 合併，或用 `services:` 直接起 postgres 而不用完整 Supabase stack（但那樣就測不到 Auth）
- `pnpm exec playwright install --with-deps` 在 Linux runner 上要裝系統相依，第一次會慢

### 3. Hosted Supabase 專案

目前全跑在本機 Docker。

**需要：**
- [ ] 建立 Supabase 專案（region 建議 `Northeast Asia (Tokyo)`）
- [ ] 取得 `DATABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] 跑 `pnpm db:migrate`（同一批 7 個 migration，已在本機驗證過冪等與 reset）
- [ ] 跑 `pnpm db:seed`

**⚠️ 一定要設，否則登入會壞：**
Dashboard → Authentication → URL Configuration
- Site URL：正式網域
- Redirect URLs：`https://<網域>/**`

本機沒設這個時，Supabase 會**靜默退回 site_url 並從 PKCE 降級成 implicit flow**，沒有明顯錯誤訊息。這是我實際踩到的 bug。

另外 hosted 的 email 速率限制在 Dashboard 設定（本機是 `config.toml`）。

### 4. Cloudflare R2

目前本機用 Supabase 的 S3 相容端點代替（`R2_ENDPOINT` 覆寫）。

**需要：**
- [ ] 建立 R2 bucket（**private**，不可公開）
- [ ] 建立 API token（Object Read & Write）
- [ ] 填 `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET`
- [ ] production **不要**設 `R2_ENDPOINT`（留空才會用真正的 R2）
- [ ] CORS：允許來自正式網域的 PUT（直傳上傳需要）

---

## 🟢 P2 — 之後才需要

### 5. AI Provider 金鑰（Milestone D 才需要）

ADR-023 免費優先。**只要設兩把免費金鑰就能開發**，建議 Groq + Google。

| Provider | 申請 | 免費額度（撰稿時） |
|---|---|---|
| Groq | console.groq.com | 免費層，延遲最低 |
| Google Gemini | aistudio.google.com | Flash 系列免費層，**免費層中唯一可靠的 vision** |
| Cerebras | cloud.cerebras.ai | ~1M tokens/日 |
| Mistral | console.mistral.ai | Experiment 層 ~1B tokens/月 |
| SambaNova | cloud.sambanova.ai | 免費額度 |
| OpenRouter | openrouter.ai | `:free` 後綴模型，可當保底 |
| **Anthropic（付費）** | console.anthropic.com | 只在升級路徑用，開發時可留空 |

> 不採用 GitHub Models — AI 島程式碼註記其於 2026-07-30 退役。

### 6. Figma OAuth（Milestone F）

- [ ] Figma Developers 建立 app
- [ ] `FIGMA_CLIENT_ID` / `FIGMA_CLIENT_SECRET` / `FIGMA_WEBHOOK_SECRET`
- [ ] Redirect URI 需正式網域

### 7. Google / LINE 登入（V1）

規劃見 `docs/spec/13-third-party-auth.md`。兩家審核都要求**已上線的網域與隱私權政策頁**。

- [ ] 隱私權政策頁（兩家審核前置）
- [ ] Google OAuth consent screen
- [ ] LINE Login channel（callback URL 要完全一致，多一個斜線就失敗）
- [ ] LINE email 權限申請（需說明用途）

### 8. 部署平台：Zeabur（ADR-008）

一個平台跑 web、worker 與 Supabase，不必分散在三家。

- [ ] 建立 Zeabur 專案
- [ ] 部署 Supabase 模板（Postgres + Auth）
- [ ] 建立 `apps/web` 服務（根目錄 `apps/web`）
- [ ] 建立 `apps/worker` 服務（長駐，不可休眠 —— 休眠會讓 pg-boss 排程斷掉）
- [ ] `DATABASE_URL` 用 Zeabur 內網位址，不對外開放資料庫
- [ ] preview 與 production 用**不同的** Supabase 與 R2 bucket
- [ ] preview 環境**不要設 `ANTHROPIC_API_KEY`** → 自動全走免費模型，PR 不會產生帳單

**部署後必做**（否則登入會靜默失敗）：
Supabase 的 `site_url` 與 `additional_redirect_urls` 加入正式網域。
沒設時 Supabase 會退回 site_url 並從 PKCE 降級成 implicit flow，且沒有明顯錯誤訊息。

**需要確認的（Zeabur 帳號建好後）**
- [ ] Supabase 模板包含哪些服務
- [ ] worker 服務的休眠策略
- [ ] 建置記憶體上限（sharp + Next build 較吃資源）
- [ ] 是否支援 PR preview environment

### 8b. CI 需要改寫

`.github/workflows/ci.yml` 目前假設 Vercel + Vercel Cron。改用 Zeabur 後：
- [ ] 移除 Vercel 相關步驟
- [ ] Cron 改用 pg-boss 的 `schedule()`（在 worker 內定義，少一個外部觸發點）

---

## 需要你決定的（不阻塞，但有時點）

| 問題 | 最晚何時 | 現況 |
|---|---|---|
| Agent 的名字與外觀 | Milestone D 開始前 | `agent_profiles` 已預留欄位 |
| 生日信內容 | Milestone E 前 | `content/letters/birthday-letter.md`，**由人寫不由 AI 生成** |
| 生日鏈第 5 環「一年後」放什麼 | Milestone E 前 | 結構已預留 |
| 是否加背景音樂 | V1 | 獨立 widget |
| 正式產品名稱 | 公開發布前 | 程式碼用 `snowrealm` 前綴，品牌走 i18n |

---

## 技術債（我自己欠的）

| 項目 | 說明 | 何時還 |
|---|---|---|
| Visual regression | `11-engineering-setup.md` §7 列了但沒做。Milestone A 沒有值得比對的視覺內容 | Milestone B 結束時（Theme 做完才有意義） |
| lefthook git hooks | 未安裝（還沒 git init） | git init 之後 |
| `packages/db` 未列在規格 §53 的結構中 | 已記在 build log，但規格本身沒更新 | Milestone B 結束時一併修訂 |
| migration 編號與規格 §0 規劃不同 | 實際按 Milestone 順序建立，非按主題 | 同上 |
