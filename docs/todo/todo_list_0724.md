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
| C — Creative Core | ⬜ 未開始 | 0% |
| D — AI Core | ⬜ 未開始 | 0%（需 AI 金鑰） |
| E — Daily Loop | ✅ 幾乎完成 | 內容池/每日卡片/驚喜盒+保底+收藏/生日鏈/主動訊息/Insight/通知全通；剩 cron 掃時區、weekly_recap 推播、Insight 的 LLM 升級（需 D） |
| F — Integration | ⬜ 未開始 | 0% |
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
- 🔴 **部署 worker 服務** — `apps/worker/Dockerfile`，不可休眠。沒它背景圖處理、排程 GC 不會跑（`/api/health` 的 queue 會是紅的）。
- 🔴 **JWT secret** — Zeabur Supabase 仍用 demo 預設 secret（key 的 iss=supabase-demo）。**正式對外前必換**，換完重新產 anon/service key 更新 env。
- 🔴 **Q10 手動走查** — 人實際點過 Milestone B 一輪（主題/背景/字體/版面）。
- 🔴 **台北黑體字檔** — 沒有穩定下載網址，需人工下載放 `assets/fonts/taipei-sans-tc/`（其餘 12 套已自動化）。
- 🔴 **AI 金鑰**（Milestone D 才需要）— 至少兩把免費（建議 Groq + Google Gemini）。
- 🔴 **內容決定** — Agent 名字/外觀（D 前）；生日鏈第 5 環「一年後」要放什麼（已有 AI 代寫版，可換）。

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
- [ ] lefthook git hooks
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
- [ ] cron 掃時區主動生成（目前是「開啟時若當天沒有就生成」，夠用但非完整方案）
- [ ] Weekly Recap 專屬通知（目前回顧在 /insights，未主動推 weekly_recap 通知）
- [ ] Insight 升級 inference/suggestion/creative（需 D 的 LLM）

---

## 🅲 Milestone C — Creative Core（未開始）

- [ ] Project CRUD、狀態、封面、tag、活動時間
- [ ] `design_files` + `design_snapshots` 建表與 API
- [ ] Library 篩選、pg_trgm 搜尋、Asset actions（13 種）
- [ ] 軟刪除 + 30 天寬限 + `asset.purge` job
- [ ] 版本比較：並排 / 疊圖 / 滑桿
- [ ] Timeline：`event.project` job、投影規則、四種檢視
- [ ] 本地分析擴充：對比檢查、留白比例、textZoneLuminance

---

## 🅳 Milestone D — AI Core（未開始，最大一塊）

- [ ] `packages/ai-core`：providers（九家）、router、resolve-usage、cache、keys
- [ ] 斷路器、低信心偵測、候選鏈升級
- [ ] `ai_usage_log`、免費/付費分開計
- [ ] Agent system prompt、context builder、SSE 串流
- [ ] 五分類 + `clampStatement` 後處理
- [ ] 10 個 tool、Memory（提案→批准、pgvector）、設計分析（light/deep）

---

## 🅵 Milestone F — Integration（未開始）

- [ ] Figma OAuth、capability matrix、webhook 冪等、同步 job

---

## 跨里程碑：隱私與刪除

- [x] ~~刪除單一 asset / 主題 / 背景 / 播放清單~~
- [x] ~~`storage.gc`：逾期上傳與軟刪除滿 30 天的清除~~
- [ ] **刪除帳號 / 刪除 space（7 天寬限）** — ⚠️ 踩到 bug：`activity_events` 的
      append-only rule 擋住 FK 的 `on delete set null`，有活動紀錄的使用者刪不掉。
      見 `docs/spec/90-build-log.md`。修法：rule 放行 FK 觸發的 SET NULL，或刪前匿名化 actor。
- [ ] 帳號匯出（zip）、AI 資料聲明頁、資料地圖頁

---

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
