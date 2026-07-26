# 工作日誌 0726

> 大量進度日。全部經閘門（typecheck/lint/rls/deps/build，多處 next start 或直連 DB 實測）＋ push 自動部署。

## 生態調查 → 平台規劃
- 派 agent 讀完全部七個 repo（AI島／Insight／YukiBoard／MD2Deck／多聞雷達／毛行天下＋Space）。
- **核心發現**：平台能力不是綠地——**AI Router 已 5 套、Z 幣 4 套、各自 Auth**。整合＝收斂，不是建置。
- 改寫 `SnowRealm-Platform-Planning.md` ＋ `SnowRealm-Platform-todo.md`：補每產品現況、收斂種子、兩兩搭配可行性。

## Agent 多模態
- **圖片(vision)**：走既有 assets 管線（ADR-005），伺服器讀位元組轉 base64，帶圖走新 `agent_chat_vision` 候選鏈（gemini/llama-vision 免費優先），持久化 `agent_messages.blocks` 供歷史重繪。
- **檔案**：前端讀文字檔貼進輸入框（不落地）。
- **語音**：`/api/agent/transcribe`（Groq whisper-large-v3-turbo）→ 轉寫填輸入框（不自動送）。沒金鑰誠實跳過。

## 🐛 生日通知 critical bug（旗艦功能靜默失敗）
- `notifications.category` CHECK 不含 `'birthday'`，但 daily-cron 送 `category='birthday'` → insert 拋錯被 try/catch 吞、`birthday_greeted_year` 沒更新 → **Nami 生日(7/24)當天站內祝福靜默失敗**。0044 補上。
- 順手：`/api/agent/message` 改只讀，proactive 收斂到 cron 一條路徑（消除競態）。

## 新功能
- **4 個 widget**（0045 mood_entries+goals）：專注計時／心情打卡／目標追蹤／創作連續；on_this_day 本就可用。`sync-widget-defs.ts`（不清 flag）。
- **隨手捕捉 inbox**（0046 capture_inbox）：`/capture` 丟念頭 → 轉筆記/封存/刪除；source 支援 yukiboard/agent（YukiBoard 鉤子落點）。
- **公開作品集**（0048 visibility + 0049 anon RLS）：作品三態 private/unlisted/public；`/p/[slug]`、`/w/[id]`；`createPublicClient` 純 anon；`/api/public/asset-url` 先驗證再簽 URL。**安全實測：anon 零 private 洩漏。**
- **分享連結**（0050 share_links）：`/s/[token]` 唯讀、可設到期、可撤銷，**對私人作品也有效**（token=授權，service-role 驗）。四情境實測（無token/過期/撤銷皆拒）。
- **Email 週報**（Resend）：0047 opt-in 開關；`apps/worker/src/email.ts`；沒 `RESEND_API_KEY` 誠實跳過。
- **筆記 CRUD**：`/api/notes` + `/notes` 頁；QuickNote widget 從單格 → 多則 CRUD（改存 notes 表）。
- **帳號匯出 ZIP**（fflate）：data.json + assets.csv + README。

## 基礎設施
- **lefthook**：pre-commit(secrets+lint) / pre-push(typecheck+deps)；實測 Windows+pnpm 環境正常。
- **Sentry-lite**：DSN-gated（設 `SENTRY_DSN` 才啟用），零 build 風險。
- **CI**：查證 e2e/a11y 早已移除、無 Vercel 假設 → 「改 Zeabur」其實已完成。

## 平台身份 prep（ADR-024）
- **識別介面** `lib/auth/identity.ts`：全站唯一讀身份處，session/context/site-admin 都收斂過去。換 SSO 只改一檔。
- **0051**：`profiles.snowrealm_id`(unique) + `snowrealm_linked_at` + `snowrealm_link_method`（先備不啟用）。
- **ADR-024**：Space 當 OIDC client；綁定「明確為主、已驗證 email 為輔」（坑#1）；解綁軟刪+資產守衛（坑#3）。
- 策略看法寫進 `docs/platform.md`（兩個時鐘、OIDC 標準、product_key 註冊表、Space 當白老鼠）。

## 全專案接線審計（3 agent）
- **API↔DB**：全清——每條路由的表/欄位都對得上 generated types，零 mismatch。
- **UI↔後端**：全部路由/header/nav 對齊，**只 1 個 bug**：Theme 匯出 JSON 用 `<a download>` 少 x-space-id → 下載 401 blob。**已修**（改 fetch+blob）。
- **RWD**：極乾淨。2 個小修：WorksClient 標題列加 flex-wrap/min-width:0；A11yPanel 表格包 overflow-x。

## 修的 UI/UX bug
- 幻燈片命名（空白預設+建立後清空+Enter 建立+既有清單就地更名）。
- 側邊欄桌機 sticky（內容捲動不跟著動）。
- Theme 手機版預覽改 sticky（往下調當下看得到；背景編輯器本就即時）。

## 待你
- **Zeabur 環境變數**：`RESEND_API_KEY`+`RESEND_FROM`（週報 email）、`SENTRY_DSN`（監控）。
- **平台決策**：開 `snowrealm-id` 專案 → 我接 Space 成 OIDC client + 綁定流程。
- 外部：字體檔、Figma 憑證、AI Dot 定價。

---

# 0726 下半場（同日續，量很大）

## 平台身份 prep（ADR-024）
- identity 介面 `lib/auth/identity.ts`（全站唯一讀身份）＋ `profiles.snowrealm_id`（0051）＋ ADR-024。
- platform.md 寫下策略看法＋鎖定架構（snowrealm.pet 入口＋snowrealm-id 發證方，email 只當輔助綁定）。

## 全專案接線審計（多 agent）
- API↔DB 全清；UI↔後端修 Theme 匯出 JSON（缺 x-space-id → fetch+blob）；RWD 修 2 處。

## 生日／UI
- 信封生日卡（信封→掀蓋→信紙升起動畫，reduced-motion 直接展開）＋內容＋Home 生日當天呈現。
- 內容池收合、app-shell 捲動（前後台側邊欄固定）、隱藏捲軸、側邊欄次要選單、明顯回首頁、版面範本（6 套）+ 還原預設。

## 設計師審計 → 系統性修復
- **補齊未定義 token**（`--sr-space-5`×35、`--sr-radius-md`、`--sr-text-xs`×103、`.sr-empty`）—全站默默壞掉的 padding／方角／字級。
- 信封卡改用主題色（color-mix）、Theme 預覽自我套用（卡片與質感即時反映）。

## 🟢 純程式批次（全清）
- Insight 五分類徽章、Theme AI 配色（paletteFromMood）、widget projectId 選擇器、
  webhook/角色頁（查證已存在）、生日/palette 單測。

## 🟡 AI 批次（部分）
- **設計視覺分析**（/api/design/vision，複用多模態，graceful）。
- **AI 深入回顧**（/api/insights/generate，weekly_recap→suggestion，clampStatement，graceful）。
- **重要 bug 修**：候選鏈踩到 Groq 已停役的 `llama-3.2-90b-vision`（實測 400）；查 Groq model list 確認**目前無 vision 模型**。
  又發現 weekly_recap/insight_phrasing/daily_prompt 只掛 cerebras/mistral（無金鑰）→ 補 groq fallback。
  且 hosted `ai_usage_models` 有**舊 seed 覆寫**會蓋掉修好的 DEFAULT → 刪掉這些 vision/text 覆寫列。

## ⚠️ 環境卡點（影響 AI live 驗證）
- **Gemini 免費額度用盡**（實測 429）、**Groq 無 vision 模型** → 視覺分析／多模態圖片目前 live 跑不動，
  程式正確且 graceful；**Gemini 額度恢復 或 加 OpenRouter(免費 vision)／Anthropic 金鑰**即可用。
- Groq **文字**正常（llama-3.3）→ AI 深入回顧實測可用。

## 🟡 仍待（兩個大件，需專注 session）
- **embedding 語意檢索**：pgvector 欄位/索引已在（memories.embedding），但**無 embedding 產生程式**；
  需在 ai-core 加 embedding API＋寫入時嵌入＋pgvector 查詢。且 embedding 模型（google）目前額度盡，無法 live 驗。
- **SSE 串流對話**：需動 ai-core 的 callAI 加串流＋route 回 stream＋AgentChat 讀 stream（core 變動，可用 groq 驗）。

## 🟡 AI 批次（續 — 全清）
### SSE 串流對話（task 33）
- `ai-core` 加 `callAIStream`（openai 相容協定逐塊 yield delta；Anthropic/Google 不支援 → 呼叫端退非串流）。
- `/api/agent/chat/stream`：純文字聊天走 SSE，額度先擋、挑第一個「有金鑰且可串流」的候選、
  存助理訊息＋更新 thread；**無可串流候選或中途斷線 → graceful 退回非串流一次吐**。
- `AgentChat`：純文字逐字顯示、首塊出現後隱藏「思考中」；**帶圖片仍走非串流 vision 路徑**。
- **實測 Groq**：14 chunks、首塊 501ms、真串流（>1 chunk）。

### 視覺解鎖（OpenAI fallback）
- 使用者加了 OpenAI 金鑰 → 視覺候選鏈補 `openai:gpt-4o-mini`（light）／`gpt-4o`（deep）當 **fallback**，
  只在免費的 gemini 失敗時才跑（成本低、遵「不要打太兇」）。Groq 無 vision、Gemini 額度盡的空窗由此補上。

### embedding 語意檢索（task 32 — 端到端可用）
- `ai-core` 加 `embedText`（openai `/v1/embeddings` 用 `dimensions:768`／google `embedContent` `outputDimensionality:768`）
  ＋ `toVectorLiteral`。**固定 768 維**對齊 `memories.embedding vector(768)`，兩家模型落同一空間。
- 候選鏈 `embedding`：openai-3-small 主、google-004 備（刪掉會遮蔽的舊 DB 覆寫）。
- 寫入時嵌入：**approve** 與**使用者新增**記憶時即時生成向量（失敗不擋、誠實降級）。
- 讀取：`match_memories` RPC（**security invoker → 沿用 owner-only RLS**，pgvector 餘弦距離）；
  `/api/memories/search`（缺金鑰退回關鍵字 ILIKE）；**Memory Center 加語意搜尋框**（顯示相似度%）。
- Agent context RAG：對話帶 `queryEmbedding` → 挑「最相關」記憶而非「最近」；無向量自動退時間序。
- `scripts/backfill-embeddings.ts` 補歷史記憶（冪等）。
- **實測 OpenAI**：768 維、17 tokens；backfill 1 則後 `match_memories('興趣愛好'→'喜歡暖色') sim=0.41` 命中。migration 0052 已套 hosted、types 已重生。
- 6 個 `embed.test.ts` 單測（mock fetch，含空向量/非 2xx/anthropic 無端點）。

### PWA 更新（task 34）
- `manifest.webmanifest`：加 `id`／`categories`／`display_override`／**4 個 shortcuts**（首頁·陪伴·今日·靈感）。
- **Service Worker**（`public/sw.js`）：導覽 network-first（**永不服務過期 HTML/chunk**，避開 CLAUDE.md 記載的 CSS 404 陷阱）、
  僅內容雜湊的不可變資產 cache-first、API 不介入、版本升 activate 清舊 cache。
- `public/offline.html` 主題化離線頁；`ServiceWorkerRegistrar`（**跳過 localhost**，dev 保持乾淨）。
- depcruise 排除 `apps/web/public/`（sw.js 由瀏覽器載入、本就 orphan）。

## 全域閘門（本批次收尾）
- typecheck / lint（web＋ai-core）/ check:rls(58) / check:deps / check:secrets / build 全綠；
  **768 單元測試全過**（+6 embed）。SSE 與 embedding 皆以真實金鑰 live 驗過。

---

## RWD 破版修復 + 字體來源文件（晚間補）

**回報（截圖 13/14）**：手機通知面板溢出畫面右緣文字被切；側邊欄選單項目 padding 太小擠成一團。
**做法**：先修兩處，再派 Explore agent 全專案掃「同類」問題一起收。

### 側邊欄選單間距（前台＋後台一起）
- `.sr-nav-link` 垂直 padding `8px → 10px`（＋圖示 20px ≈ 40px 點擊高度，接近 WCAG 目標尺寸）。
- `.sr-sidebar-nav` / `.sr-sidebar-secondary` 項目間距 `2px → var(--sr-space-1)`（4px）。
- `.sr-nav-sub` padding `6px 10px → var(--sr-space-2) var(--sr-space-3)`（8/12）。
- **後台 AdminShell 沿用同一批 class**，上述改動一併生效；另補 `.sr-admin-navgroup` 改 flex column + gap（原本群組內連結 0 間距）。

### 通知面板防溢出（加固）
- 手機 override 已存在（`fixed` + `inset-inline`）。加 `max-width: calc(100vw - 2*space-3)` 當防線
  —— `.sr-topbar` 有 `backdrop-filter` 會成為 `fixed` 的包含塊，明確夾住寬度後任何情況都不破版。
- `top` 改用 `calc(var(--topbar-h) + space-1)`（原寫死 60px）。

### 全專案 RWD 掃描結論（Explore agent）
- **右錨點下拉**：全站僅通知面板一個，已修；`.sr-tour-tip`（有 clampLeft+max-width）、`.sr-dialog`、`.sr-cookie` 皆已響應式。
- **寬表格**：後台 15+ 張 `.sr-table` 全部已包 `overflow-x:auto`，無漏。
- **nowrap / min-width**：都在窄內容或 `flex-wrap` 列，加上 `html,body{overflow-x:hidden}` 安全網，無水平溢出源。

### 字體來源文件（task）
- 新增 `docs/fonts/README.md`：14 套字體（9 繁中＋5 拉丁）完整下載來源表、一鍵指令、OFL 注意事項。
- **台北黑體**為唯一人工步驟：翰字鑄造 JT Foundry <https://sites.google.com/view/jtfoundry/>，其餘 13 套 `scripts/download-fonts.ts` 自動化。

---

## 後台字體管理（上傳／安裝／啟用／移除）

**需求**：Luffy 下載好字體（台北黑體）想直接在後台上傳，不用跑 CLI。
**做法**：把 `download→build→upload` 這條 CLI 管線的 build+upload 兩步搬進後台 route，
維持 ADR-016 的不變量 —— **只安裝內建目錄（ALL_FONTS）的 OFL 字體**，metadata 一律取自目錄，
授權全文必填（不接受任意使用者字體）。

- `lib/fonts/subset.ts`：`build-fonts.ts` 的執行期版本，記憶體內把 ttf/otf 切成 unicode-range woff2 分片（同一套分片、同一首屏預算）。
- `POST /api/admin/fonts`：上傳原始檔＋授權 → 子集化 → 超預算擋下（誠實）→ 先授權後字體上傳 R2（`public/fonts/<slug>/`）→ upsert `fonts` 表。
- `GET`：已安裝清單（含停用）＋目錄安裝狀態；`PATCH ?slug=`：啟用/停用；`DELETE ?slug=`：先刪 R2 分片再刪列（font_pairs FK cascade）。
- `/admin/fonts` 頁＋`FontsAdmin` client：選目錄字體→上傳字體檔＋授權→即時安裝；已安裝表可切換/移除。後台側邊欄新增「外觀資源 → 字體管理」。
- `subset-font` 加進 apps/web 依賴；`next.config` 設 `serverExternalPackages: ['subset-font']`（harfbuzz wasm 執行期從 node_modules 載，不被 webpack 打包）；補 `types/subset-font.d.ts`。
- **驗證**：typecheck / lint / check:secrets / check:deps 全綠；`next build`（獨立 dist）成功，wasm 外部化後不破 build。

**台北黑體安裝步驟**：後台 → 外觀資源 → 字體管理 → 選「台北黑體（需人工下載）」→ 選 3 個字重檔（Light/Regular/Bold）＋ OFL 授權檔 → 上傳並安裝。

---

## UI/主題/後台一批（晚間續，逐項 commit）

- **選單 padding 再加大**：`.sr-nav-link` 8→10→12px（前後台選單）；`.sr-admin-navgroup` 補 flex gap。
- **「← 回前台」按鈕**：改實心強調色 + 微陰影（原透明 secondary 與頂列混色）。
- **角色標籤**：平台 owner（luffysky00）標「擁有者」；其他空間 owner（nami0724）標「管理員」（用 checkSiteAdmin.role 區分）。
- **空間名稱就地改名**：SpaceShell 品牌名 owner 點一下編輯 → `PATCH /api/space`（id 取自 session 防 IDOR、owner+RLS 雙保險）→ router.refresh。
- **深淺色自動配對**：`deriveDarkTheme` 卡片/底色壓中性（不再深粉紅）；新增 `deriveLightTheme`/`isDarkTheme`/`effectiveTheme`（依底自動選模式，深色主題也能反推淺色）。dark-mode.test 11/11。
- **Secret 產生器**（`/admin/secrets`）：前端 crypto 產生，長度 8/16/32/64、字元組合 hex/base64/英數/純英/純數/英數+符號、各長度用途表、copy。
- **Secret 紀錄**（0054）：`admin_secret_notes` 值 AES-256-GCM 加密後存（主金鑰在 env）；RLS 無 policy → 只 service role + checkSiteAdmin；GET 列表/reveal、POST、DELETE；UI 可存/顯示/刪。types 手動補（gen types 需 Docker，本機無）。

---

## 0726→0727 大批次（富文本 / 附件 / 字體 / 深淺背景 / 平台文件 / 稽核）

**功能**
- **富文本編輯器**（`@/components/rich`）：tiptap v3，功能對齊 AI 島（標題/刪除線/行內碼/程式碼區塊 lowlight/螢光筆/文字顏色/對齊/待辦清單/表格/Markdown 貼上/字數）+ 自刻表情、GIF、`ChatMedia`；存 HTML + 伺服器 sanitize；筆記、捕捉接上。
- **Agent 對話**：表情 + GIF（giphy 代理）+ **傳任意檔**（影片/音檔/任意檔，走 assets）；圖片/影片脫離氣泡框直接顯示、可點開、圖片可存。
- **字體後台自動安裝**：`/api/admin/fonts/install` 伺服器抓 google-fonts/github → 子集化 → R2（拉丁 OK）。**中文 9 字重會 524 逾時 → 待移 worker**。全字重 100–900。
- **深/淺色各自指定背景**（0056）：`spaces.bg_light/dark_item_id` + `background_items.tone`；resolver 依模式挑；Studio ☀/☾ + 色調鈕；toggle 後 refresh 換背景 + 深色暗罩。
- **Secret 產生器 + 加密紀錄**（0054）、**大頭貼**（0055）、**對話歷史摘要**（agent_threads.summary + conversation_summary usage）。
- **Canva 設計來源**註冊（provider-core，connectable=false 待憑證）。
- 深淺色自動配對（effectiveTheme）、選單間距、創作連續框、時間軸排版+widget、CI 型別漂移修正、字體大檔錯誤訊息。

**平台文件**
- `docs/SnowRealm-SDK-vs-Platform.md`：Platform HTTP / SDK / 薄 client 分界 + 富文本 SDK 計畫 + **資料夾拓撲與遷移順序**（產品各自 repo + 一個 platform monorepo）。
- `docs/fonts/README.md`；`todo_list_0724.md` 底部加「你要做的事—詳細步驟」（AI金鑰/Email/Google/LINE/Figma/Canva/JWT/字體/Giphy/Sentry）。

**稽核（兩個 agent）**
- **API↔DB↔UI 接線**：無半接線缺陷——表/路由/8 條新功能鏈全接上、無假按鈕。
- **RWD/PWA**：PWA 全對；RWD 修 3 處（富文本表格拉寬可橫捲不裁切、對話媒體+文字改直排、emoji/gif 面板加 max-width）。

全程 typecheck/lint/secrets/deps/rls 綠、`next build` 通過。DB 到 0056。

---

## 0727：字體自動安裝移 worker（解中文 524）

**問題**：後台自動安裝思源黑體回 524——中文一套子集化 9 字重 × ~48 分片 × 16MB 原檔，同步 HTTP 超過 Cloudflare 100 秒。
**做法**：把重運算移到 worker 背景 job（無 HTTP timeout）。

- `apps/worker/src/handlers/font-install.ts`（新）：fetch 來源（google-fonts/github-branch/github-release .ttf）→ 記憶體內子集化（subset-font + theme-engine 分片）→ 上 R2 → upsert fonts。冪等（onConflict slug）。
- `boss.ts` QUEUES.fontInstall；`index.ts` 註冊 handler（`batchSize:1`，一次一個免吃爆記憶體）；worker 加 `subset-font` 依賴 + 型別 shim。
- `/api/admin/fonts/install` 改成只入列（`enqueue('font.install')`，singletonKey 防重複）→ 202 快回。
- `FontsAdmin` 自動安裝：入列後每 5 秒輪詢 `/api/admin/fonts`，目標 slug 出現在 installed 即通知（最多 ~5 分鐘）。
- 拉丁字體照樣秒裝；中文字體現在也能免 CLI、不逾時。
- **注意**：動到 worker → Zeabur worker 服務也要重新部署才認得 `font.install`。
- 閘門：web/worker typecheck、lint、check:deps 全綠。

> 之後平台重構時，web 上傳路徑（`lib/fonts/subset.ts`）與 worker 這份 fetch+subset 可收進 `@snowrealm/font-build` 套件去重。

---

## 0727：抽出 `@snowrealm/rich-editor` SDK（第一階段）

**目標**：把富文本從 `apps/web` 收成可攜套件，讓未來社群 / SnowRealm Platform 動態牆能複用同一套編輯器。

- 新套件 `packages/rich-editor`（type:module、`src/index.ts` 為入口，pattern 對齊 widget-engine）：搬入 `RichEditor` / `EmojiPicker` / `GifPicker` / `RichHtml`；tiptap+lowlight+tiptap-markdown 進 deps、react/react-dom 當 peer。
- **耦合拆兩處**（否則不可攜）：
  - `promptLink`（必填）：SDK 不再直接依賴 `useDialog`，改由宿主注入網址對話框。
  - `giphyEndpoint`（預設 `/api/giphy`）：Giphy 代理端點參數化。
- **web 端保留 `components/rich/*` 薄包裝**：`RichEditor` 注入 `useDialog` 的 prompt，其餘直接 re-export → 三個消費端（notes / capture / agent）**import 路徑與行為都不變**。
- `next.config` `transpilePackages` + `apps/web/package.json` workspace dep 加它；dep-cruiser 無違規（react/tiptap 套件不受 `packages/ui` 的禁 workspace-deps 規則約束）。
- **刻意留在 web、之後再搬**：`sanitizeRichHtml`（伺服器端 sanitize，避免把 Node 依賴帶進 client bundle）、`ChatMedia`（還綁 `/api/assets` 與聊天 UI）、`.sr-rich*` 樣式（仍靠宿主 globals.css + `--sr-*` token）。文件已標「目前現況 vs 最終目標」。
- 閘門：package + web typecheck、lint、check:deps 全綠；isolated `next build`（`.next-verify`）驗證 notes/capture/agent 三頁正常打包（各 353 kB，含編輯器）。

> 下一步（非本次）：`sanitizeRichHtml` 抽成套件的 Node 專用子路徑、`ChatMedia` 以 `resolveAssetUrl` prop 解耦、`.sr-rich*` 出獨立 stylesheet——對外發佈前再做。

---

## 0727：worker 字體安裝 OOM（中文 SIGTERM）→ 串流式子集化

**症狀**：worker log 在字體安裝時 SIGTERM。派 agent 讀程式做記憶體剖析。

**根因**：`font-install.ts` 舊版把整套字重×分片先全部子集化累積在陣列（中文 9 字重 × ~47 片 ≈ 423 個 woff2 buffer），**再一次上傳**。尖峰＝原始 TTF + 全部 423 個 buffer + harfbuzz-wasm 記憶體同時存在；靜態多檔字體還會一次把 9 個 TTF（~9×16MB）全留著。worker 沒設 `--max-old-space-size`、也不知道容器上限（`Dockerfile` 無 NODE_OPTIONS）→ 記憶體受限容器被 OOM kill → SIGTERM。

**修法**（`apps/worker/src/handlers/font-install.ts`）：
- `subsetFontFiles`＋`installOne` 的兩段（先全部子集化、再全部上傳）合成一段 **`buildAndUpload` 串流**：每產一片就上傳一片、隨即丟掉 body，只留幾十 bytes 的 metadata → 尖峰子集 buffer 從 ~423 降到 ~1。
- 每個來源檔處理完把原始 TTF 位元組設 null 釋放（靜態多檔省數十 MB）。
- 子集化仍逐一 await（不並行），行為與輸出（file_manifest / weights / 預算檢查）不變。
- 閘門：worker typecheck、lint、check:deps 綠。

> 這是純程式面的降記憶體；**另一半是 Zeabur 容器記憶體**要夠（in-repo 沒有也不該有容器設定）。若還會 OOM，於 Zeabur 調高 worker 記憶體，或視情況加 `NODE_OPTIONS=--max-old-space-size`（註：harfbuzz 是 off-heap，heap flag 只治一半）。
> 之後平台重構時，web `lib/fonts/subset.ts` 與 worker 這份可收進 `@snowrealm/font-build` 去重＋共用這套串流。

---

## 0727 續：SDK 化、AI 角色、帳號、字體、RWD 一連串

**SDK 抽出（絞殺式）**
- `@snowrealm/rich-editor`：富文本抽成套件，web 保留薄 wrapper（promptLink/giphyEndpoint 解耦），三消費端不動。
- `@snowrealm/vrm-character`：**移植 insight-engine 的 VRM 角色**——YukirinScene/RikuScene（自包 three.js）、
  loadMixamoAnimation、vrmLipSync、bus、VrmWidget（漂浮/可拖曳/雙角色切換）。next/dynamic 換 React.lazy 解耦 Next。
  資產（.vrm/.fbx）留 apps/web/public。

**AI 角色 + 情緒協定**
- Agent 對話加使用者/AI 頭像＋名稱（agent_profiles）；頁面「Agent」對外改叫「AI 夥伴」。
- **幫 AI 命名**：PATCH /api/agent/profile（RLS owner）＋ AiNaming（第一次引導取名，預設 'Agent' 視為未命名）。
- **LLM 直接吐情緒**：串流 system prompt 要求尾端 `⟦mood:x⟧`；SSE 保留尾端 32 字 strip 標記→補送→發 {mood}；
  存 DB 是乾淨文字；客戶端收 {mood}→emitVrm 驅動角色，模型沒照格式退回啟發式。這是「聊天服務結構化側訊號」種子。
- `docs/SnowRealm-SDK-vs-Platform.md` 補「聊天 AI：一個服務 + 兩個 SDK（chat / vrm-character）」藍圖。

**帳號**
- 登入方式加「更改密碼」（不落地 session 驗舊密碼，純帳號也能用）。
- 「帳號就帳號」：合成 `@users.snowrealm.pet` 不對外顯示（lib/auth/account-identity）；刪帳號二次確認改輸帳號。
- Google/LINE OAuth 自架 GoTrue 設定寫進 todo（`GOTRUE_EXTERNAL_GOOGLE_*` + `MANUAL_LINKING_ENABLED`；LINE 不經 GoTrue）。

**頭像全站**：可複用 `<Avatar>` + lib/avatar（同 space 走 RLS、跨 space 後台走 admin client）。
放進品牌列、登入方式、後台使用者/Space/對話。修「上傳後沒變」（缺 x-space-id + router.refresh）。

**字體**
- 主題選字體「即時預覽」補上（ThemePreview 注入 @font-face + 寫 --sr-font-*）。
- 加「儲存並套用」一鍵（消除先存再套的困惑）。
- **可選字重**：typography.headingWeight/bodyWeight → --sr-weight-* → body/heading CSS；FontPanel 加字重下拉。
- 字體自動安裝改串流式子集化（worker + web），修中文 OOM。全字重 100–900（含中文）。

**運維 / RWD**
- worker SIGTERM：非 OOM，是平台健康檢查沒 port → 加 $PORT 健康 HTTP server。
- VRM 角色資產被 auth gate 攔（307→/gate）→ middleware matcher 排除 .vrm/.fbx（+ .gitattributes 標 binary）。
- RWD 稽核：全站大致已硬化，唯 VRM 面板沒夾視窗 → 改 min(260, 100vw-24)/min(340,100dvh-104)、抬高避開右下控制、
  補 .sr-studio-controls min-width:0。

全程 typecheck/lint/check:deps 綠、多次 isolated next build 驗證、push 自動部署。

---

## 0727 尾：拿掉 VRM，改 2D「綠寶風」漂浮 AI 夥伴

Luffy 決定 VRM 太重（手機卡/無回應、包大、暫時非必要）→ 拿掉，做成像 AI 島綠寶導師的 2D 呈現
（一樣 AI 對話、少了 3D）。派 agent 讀 ai_island_v3 確認綠寶＝2D 漂浮聊天（漸層球 launcher + emoji 頭像 +
persona chat panel），非 VRM。

- **移除**：刪 `@snowrealm/vrm-character` 套件、`.vrm`/`.fbx`（~32MB）、three 依賴、transpilePackages、workspace dep。
- **mood 匯流排改 web-local**：`lib/agent/mood.ts`（emitAgentMood/onAgentMood + MOOD_EMOJI）取代 VRM bus；
  AgentChat 的情緒改發這個。**LLM 吐 `⟦mood:x⟧` → 2D 表情 emoji**（不再驅動 3D）。
- **FloatingAgent**（新）：全站漂浮可拖曳漸層球（emoji 依情緒變 + 名字）→ 浮動對話卡，
  複用 AgentChat（新增 `autoload` prop 自載最近對話；React.lazy 打開才載，一般頁面不背它）。
  用戶選「兩個都要」：`/agent` 分頁保留 + 全站漂浮球。
- 閘門：typecheck/lint/check:deps 綠；build /home 136KB、/agent 135KB（無 three、聊天 lazy）。

> 決策：呈現「兩個都要」、頭像「2D 依情緒換表情」。VRM SDK 作廢，`@snowrealm/chat` + 聊天服務藍圖仍有效。
