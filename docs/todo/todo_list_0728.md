# todo_list_0728 — 進行中規劃（新）

> 這份專記「還在做 / 接下來做」的規劃，2026-07-28 起。
> 已完成的歷史與外部憑證細節仍見 `todo_list_0724.md`（#13 是 F 的完整進度清單）。

---

## A. Milestone F — Integration（sync 半段，切片進行）

> 決定：F 納入 Canva（覆寫 spec §F「不做 Canva」，見 `90-build-log.md`）。
> 工作法：子代理寫一塊、主對話逐檔審 + 獨立重跑閘門後才 commit。

### 已完成（今天）
- [x] **連接半段**：OAuth connect/callback（Figma+Canva）、token AES-256-GCM 存 `design_connections`、
      設定頁連接/中斷 UI、後台 Token 轉換器。commit `3dea7a1`。
- [x] **S1**：adapter 列檔/抓檔、選檔同步（禁整 Team）、建 `design_snapshots`、rendition 走 StorageAdapter 進 assets。commit `86bd8b9`。
- [x] **S2**：抽 `@snowrealm/design-sync` 套件；`design.sync` worker job（單檔一 job、singletonKey 去重、
      handler 主導退避、429 依 Retry-After、連 5 次失敗轉 error+通知）；`POST /sync` 改入列 202。15 retry 測試。

### 待做
- [x] ~~**S3 — webhook 觸發同步**：`/api/webhooks/[provider]` 接上 canva；驗簽+非重送才觸發，找受影響 `design_files`（sync_status=active、connection status=active）逐列入列 `design.sync`（與手動同步同契約）。provider-core 加 `affectedFileExternalIds`（Figma=file_key／Canva=design.id 防禦性，掛 TODO）+8 測試。~~ ✅ 0729（子代理寫、主對話逐檔審+schema 核對+四閘門綠）
- [x] ~~**S4 — UI**：選檔 picker（`FilePickerDialog`，列 `/files`+勾選送 `/sync`、Figma 需專案 ID、無全選、上限 50、誠實狀態、行動安全）；
      `/files` 每檔標真實 `design_files.last_synced_at`；版本比較沿用 `/works`（其查詢無 provider 濾鏡、同步檔已涵蓋，不重造）。~~ ✅ 0729（子代理寫、主對話逐檔審+四閘門綠+CSS class 全存在）
- [x] ~~**S5 — mock（harness）**：`provider-core` 加可注入 HTTP seam + `record.ts`（env-gated 去敏錄製）+ `replay.ts`（重播真 adapter、缺 fixture 拋錯不回假資料）+ skip-gated 測試（fixtures 缺→`it.skip` 附原因）+ `__fixtures__/README.md`~~ ✅ 0729（子代理寫、主對話審 seam off-by-default／redaction／server-only／四閘門綠）
- [ ] **S5 — 真實 fixtures**：仍**卡首次真憑證+真檔實跑**，用 `DESIGN_SYNC_RECORD_DIR` 錄真回應放進 `recorded/`，測試自動改跑。
- [ ] **🔴 Figma 端點/scope 實測校正**：provider-core 內 `TODO(figma)` 全部待對最新 Figma 文件實測（2024 改版後 token/scope 有變）。Canva 那側也尚未對真帳號實跑。

### 前置（Luffy 已備）
- [x] Zeabur web + **worker** 皆設 `CANVA_*`/`FIGMA_*`/`TOKEN_ENCRYPTION_SECRET`（兩服務 TOKEN 同值已確認）。
- [x] Canva 後台 redirect 設 `…/api/integrations/canva/callback`（app 保持開發狀態、不用送審）。
- [x] ~~後台開 flag `canvaConnect` / `figmaIntegration`~~ ✅ 0729（provider 端點啟用）。
- [x] ~~AI 金鑰（Groq＋Gemini 貼後台）+ `AI_KEY_ENCRYPTION_SECRET`；Resend（`GOTRUE_SMTP_ADMIN_EMAIL`+`RESEND_API_KEY`）；Google/LINE 憑證＋隱私頁~~ ✅ 0729（Luffy 一批設好，見 0724 🅰）。
- [ ] **第一次端到端試**：設定頁連 Canva/Figma → 選檔（S4 picker）→ 同步 → 看 `design_snapshots` 出版本
      （順便**錄真實回應**供 S5 mock、校正端點/scope）。

---

## B. 內容補量到 4000（#50，長期）

> 已達標：quotes 4045 / prompts 4001 / questions 4000 / greetings 1000。
- [ ] **micro_action / seasonal / welcome 三池補到各 4000**（截至今天約 1955 / 1932 / 1940）。
      多-agent 產線（見記憶 `content-4000-marathon`），每輪 check:content + 手動抽讀 + 反向 + 撞號檢查。
      **需調高 `CLAUDE_CODE_MAX_SUBAGENTS_PER_SESSION`（建議 1000）重開 session 續跑產線。**

---

## C. 天氣（#49 / #56，✅ 0729 完成）

> Open-Meteo（免金鑰）+ 伺服器 proxy；隱私預設關、只存城市名、座標不落地；flag `weatherWidget` gate（關→404）。
> 子代理寫、主對話逐檔審 + 全閘門（含 full test suite 抓到並修好 registry.test 的過時斷言）+ hosted DB 落地驗證。

- [x] ~~**#56 頁面天氣動畫區塊**~~ ✅ 0729：`weather` widget（日/夜太陽月亮＋氣溫＋地區＋`ProceduralScene` overlay 動畫、reduced-motion 降級、可暫停）、
      `/api/weather`＋`/lookup`（RLS、flag→404、位置只進 body 不進 URL）、設定頁 opt-in（城市＋「使用目前位置」→BigDataCloud 反查、隱私政策已誠實揭露）。
      **DB 已落地**：`sync-widget-defs` 補 `weather` 定義列 + `feature_flags.weatherWidget`（enabled=false，待後台開）。
- [x] ~~**#49 天氣感知內容**~~ ✅ 0729：抽 `@snowrealm/weather` 套件解分層 → daily-engine 生成時查天氣轉 tag 併入 context、
      `selectSeasonal` 讓 ~1700 則休眠天氣 seasonal 內容真的被選中；天氣失敗絕不阻斷生成（try/catch→[]、8s timeout）；選取仍決定性。

---

## D. 其他既有待辦（延續 0724）

- [ ] **#55** 內建背景擴充 + 套件化下載（動態/靜態/Lottie，分類、下載後套用、未下載可預覽）。
- [ ] 對話歷史摘要（長對話壓縮）。
- [ ] 站內 AI Agent 每日額度調高（待討論，見 0724 Milestone D 區）。
- [ ] `SENTRY_DNS` → 已改為 `SENTRY_DSN`（Luffy 0728 修正，Sentry 可啟用）。

---

## E. 0729 進行中 / 新規劃

> 子代理寫、主對話逐檔審 + full test suite + hosted DB 落地後才 commit。

- [x] ~~**Works AI 對話 + 分析歷史 + 長期記憶**~~ ✅ `fc2617d`：可對話（Agent SSE + 多模態 + pgvector 記憶）；分析寫進 `design_insights` 存歷史（列時間·來源軟體·專案·版本·模型）；per-work thread 用 `context_refs` 綁定。
- [x] ~~**Adobe 連接骨架**（flagged `adobeExpress`，卡憑證）~~ ✅ `2734bdd`：capability/adapter 全鏈補齊、端點 TODO、尚未設定不擺假按鈕。
- [x] ~~**Figma scope env 覆寫**~~ ✅ `2734bdd`：`FIGMA_SCOPES` env。**Invalid scopes 根因＝Figma app 沒勾 `files:read`**（去後台勾）。
- [x] ~~**修：widget picker 沒依 flag 過濾**~~ ✅ `2734bdd`：依 `getFlags` 過濾（消除假關閉）。
- [x] ~~**天氣城市 autocomplete**~~ ✅ `a4ae430`：Open-Meteo 即時搜尋（縣市/區/外島＋外國城市）、免寫死清單、解 i18n 疑慮。
- [x] ~~**多帳號連接**（Canva/Figma/Adobe 每 provider 多帳號）~~ ✅ `ae9f079`：免 migration（schema 本就支援）；callback 抓帳號依帳號 upsert、設定頁每帳號一張卡。
- [x] ~~**後台使用者上線資訊**（仿 AI 島）~~ ✅ `bba97d5`：`user_sessions`（migration 0059、已套 hosted）、heartbeat、在線 badge、地區/裝置；**只存 ip_hash+地區、不存原始 IP**；外部 IP→地區經 Luffy 選用、已揭露。
- [ ] **🌐 i18n（之後排）**：全站多語。參考 AI 島用**腳本 + Google 翻譯免費**批次翻。天氣 autocomplete 已先避免寫死中文地名清單。
- [ ] **型別正式重生**：本機開 Docker 後 `supabase gen types --local` 對齊 user_sessions（現手補、typecheck 綠）。
- [ ] **🔴 Adobe 整合 — PS/AI/PR/AE（必做，Luffy 0729 定案；延後實作）**：Creative Cloud 桌面系列，走 Adobe IMS OAuth + CC 檔案 API。
      現為骨架（連接顯示「尚未實作」）。前置＋做法詳見 `todo_list_0724.md` §5c。
      注意：PR/AE 是影片專案檔（非圖片），AI 分析只能對匯出的預覽/影格；PS/AI 可出圖走既有 rendition 路徑。
      真正動工前我要補 `design_connections.provider` 加 `adobe` 的 migration。

## 收工狀態（2026-07-28）
連接半段 + S1 + S2 已審過並 push；F 到「可連、可選檔同步、worker 背景重試」的程度，
差 S3（webhook）、S4（UI）、S5（mock）+ Figma 實測即閉環。內容三池續補待重開高配額 session。
