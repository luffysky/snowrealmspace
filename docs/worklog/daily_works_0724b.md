# Daily Works — 2026-07-24（第二輪）

Luffy。Claude 值班。
主題：**帳密體驗補齊 → 深淺色切換 → Milestone E 收尾（保底/收藏/主動訊息/Insight/通知）**。
承接 `daily_works_0724.md`。**本輪起 E2E/a11y 暫停跑（CI 一直churn），改靠 typecheck / 單元 / RLS / 直連 DB 驗證。**

---

## ✨ 新做的

### 1. 帳密體驗（跟一般網站一樣）
- 密碼強度判斷（`passwordStrength` 純函式 + 7 測試）＋ 即時強度條。
- 顯示/隱藏密碼眼睛（`PasswordField`，可鍵盤操作、44px 觸控區）。
- 忘記密碼：`/forgot`（真 email 才寄、一律回同訊息防帳號枚舉）＋ `/reset-password`（recovery session 設新密碼）。
- 登入後對「沒有救援方式的帳號」（純使用者名稱、沒綁 email/Google/LINE）跳綁定提醒橫幅 —— 忘記密碼才有救。
- 帳號欄位純用「帳號」不再提 email。

### 2. 深淺色切換（選項 A）
- `deriveDarkTheme`：為**任何主題**自動推導暗色版 —— 保留使用者選的色相與個性，只翻明暗，
  背景暗、文字亮、強調色提亮到暗底仍鮮明，並確保文字對背景 ≥ 4.5 對比（5 測試）。
- nav 日/月圖示鈕，cookie 記住模式，SSR 首屏就對、不閃，切換直接改 `:root` inline style（<150ms）。

### 3. Milestone E 收尾
- **驚喜保底**：連續 15 盒沒開到 rare 以上，下一盒強制 rare（開盒時算 drought）。
- **驚喜收藏牆** `/surprises`：開過的驚喜依稀有度上色卡片、可收藏（★樂觀更新+回滾）、只看收藏；**機率公開**不藏數字＋保底進度。
- **Insight Engine** `/insights`：5 種 fact/metric 類型（出沒天數、主題調整、上傳、整體活動、最常做的事），
  純本地演算法、confidence 恆 1.0、evidence.sourceIds 可追溯，文案是數據描述非空泛判斷（v1.0 §23.5）。可刪。
- **主動訊息**（規則式，不用 LLM）：里程碑（第一套主題、第一個上傳）＋每日陪伴訊息，
  頻率上限 3/日、Quiet hours、全部先過 `FORBIDDEN_PATTERNS`（被攔不寫入）。D 有 Agent 再升級。
- **通知**：nav 鈴鐺（未讀角標、下拉、已讀、全部已讀、一鍵關閉連到設定），分類。
- **Agent 訊息 widget** 實作（進 Home 觸發主動訊息、顯示最新一則）→ 從「未實作」進預設版面。
- 設定頁新增「Agent 與通知」（主動訊息模式 off/重要/每日、Quiet hours）與「每日與回顧」入口。
- migration `0016_insights_notifications`（insights + notifications + RLS + grants；agent_messages 屬 D 不建）。

---

## 🐛 修好的

### 🔴 註冊 500（digest 738593465）—— R2 未設定拖垮全站
- 真因：`serverEnv()` 把 R2_ACCOUNT_ID/KEY/BUCKET 當必填、R2_ENDPOINT 當必為 URL；R2 還沒設定（Zeabur 傳空字串）
  → `serverEnv()` 一啟動就拋錯 → **每個用 admin client 的 server action（含註冊）全 500**。
- 修：R2 env 全改 optional，空字串視為未設定；真的要動用儲存時才在 `storage/r2.ts` 清楚報「R2 尚未設定」（不靜默）。
- 打 hosted 完整重現註冊→進站 6 步全過。

### CI milestone-a 閉環被站台閘門擋
- 閘門把所有請求導 `/gate`，害 auth 閉環測不到（callback/home 被攔 → membership null → crash）。
- 修：驗證腳本帶 `sr-gate` cookie（代表已過閘門的瀏覽器）；未登入測試只帶閘門 cookie。本地 24/24 綠。

### CI E2E 4 紅（登入頁結構改動連帶）
- 鍵盤 a11y 流程、magic link 摺疊、password-auth 選擇器、widgets「未實作範例」（驚喜盒已實作→改 Agent 訊息）。

### 靜默失敗（自己抓到）
- insight/notification 的讀取原本 `data ?? []` 吞掉錯誤 → 驗證時被 schema cache 假象誤導。改成錯誤要 log（CLAUDE.md）。

---

## 🔍 API↔DB / UI↔後端 對接驗證（Luffy 要求）

- **API↔DB**：insights / notifications 的每個寫入欄位用直連 SQL 逐一插入驗證（欄位名、型別全對）；
  再打 hosted supabase-js 跑 `generateInsights / listInsights / deleteInsight / createNotification / list / unreadCount / markRead / markAllRead` 全 ✓。
- **UI↔後端**：前端 13 個 `fetch('/api/...')` 每個都有對應 route（新增 `/api/agent/message`、`/api/notifications`），無斷線；
  server action 型（刪 insight、收藏、Agent 設定）co-located 且 typecheck 通過。
- 過程釐清一個假象：supabase-js 走 `.env.local`（hosted），一度誤判「本地 schema cache 壞」——
  其實是 hosted 還沒套 0016；套上後 auto-reload，全通。

---

## ⏳ 仍需 Luffy 操作

- **Zeabur redeploy 抓最新 commit** → 註冊才會通、E 新功能才上線。
- 其餘同 `todo_list_0724.md` 🔴 區（Resend 網域、R2、worker、JWT secret、字體檔、AI 金鑰）。

---

## 今日（第二輪）commit 序

帳號欄位改「帳號」→ 帳密體驗（強度/眼睛/忘記密碼/綁定提醒）→ 深淺色 A →
驚喜保底+收藏 → milestone-a 閘門修 → **R2 optional（修註冊 500）** →
Insight/通知/主動訊息（E 收尾）+ 對接驗證 + 文件。

閘門：typecheck / 522 單元 / check:rls(30 表) / check:secrets / check:deps 全綠。**E2E/a11y 本輪暫停（Luffy 指示）。**

---

## 🧹 收尾（Luffy：待辦記全、API/DB/UI/RWD 接好不破版、寫日誌）

### RWD 稽核（靜態，不跑 E2E）
- **抓到一個真的會破版的**：nav 加了通知鈴鐺 + 日夜鈕後，手機上 `.sr-nav-end` 變全寬 `space-between`，
  鈴鐺落在最左；通知面板原本 `position:absolute; inset-inline-end:0`（往左展開）→ **會溢出畫面左緣**。
  修：手機 breakpoint（≤767px）把面板改 `position:fixed; inset-inline: space-3`（貼齊視窗兩側）。
- 其餘全數複查通過：`/insights`、`/surprises` 網格都用 `minmax(min(100%, N), 1fr)`（欄寬永不超過容器）；
  odds/insight-foot/binding/agent-settings 各 row 都 `flex-wrap`；`html,body { overflow-x:hidden }` 保底。
- nav 本身 `flex-wrap`、手機 nav-end 全寬換行 —— header 不會被撐寬（CLAUDE.md 第 5 坑）。

### 接線確認（本輪已驗證）
- **API↔DB**：insights/notifications 欄位直連 SQL 驗證 + hosted supabase-js 全 CRUD ✓。
- **UI↔後端**：前端 13 個 `fetch` ↔ route 一一對上，無斷線；server action 型 co-located + typecheck。
- **RWD**：如上，修一處、其餘通過。

### 待辦
- `todo_list_0724.md` 全面更新：E 全打勾、深淺色打勾、帳密體驗/註冊修復/milestone-a 修/RWD 打勾；
  🔴 區頂部加「Zeabur redeploy 最優先」；技術債補 3 條（insight 軟刪 upsert、cron 掃時區、新引擎缺單測）。

閘門仍全綠。E2E/a11y 依指示不跑。
