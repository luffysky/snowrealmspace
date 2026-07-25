# Daily Works — 2026-07-25

Luffy。Claude 值班。
主題：**Agent 語氣（參考 AI 島 persona）→ 管理後台全數補齊 → Lottie 動畫背景 → 收尾驗證**。
承接 `daily_works_0724c.md`。E2E/a11y 依指示不跑，改靠 typecheck / 單元 / RLS / check:deps / check:secrets / 直連 DB 驗證。

---

## ✅ Agent 語氣（AI 島 persona）

- `ai-core/agent-prompt`：加 `TONE_VOICES`（warm/gentle/professional/playful/concise）+ `ctx.tone`；
  `renderContextSuffix` 依語氣在最前面加一段「這次的語氣」。未設定或未知值不注入（不炸）。
- `lib/agent/context.ts`：讀 `space_settings.agent_tone` 注入。
- 設定頁 `AgentSettings`：語氣下拉 → `updateAgentSettings` 寫入 + emitEvent。
- 欄位早在 0002（default warm）→ 本次補上唯一缺的 UI 與寫入路徑，端到端可用。加 3 個反向單元測試。

## ✅ 管理後台其餘頁（照 AI 島路徑，全數完成）

皆走 `checkSiteAdmin` + service role，用真實資料表，無假頁；`--sr-*` token、無 hex。

- `/admin/ai/candidates` 候選鏈（ai_usage_models 主模型 + fallback 序）
- `/admin/ai/quota` 每日額度（ai_daily_quota 免費/付費/視覺）
- `/admin/ai/cache` 回應快取（命中率 + scope，凸顯跨 space 隔離）
- `/admin/agent-actions` Agent 動作（工具呼叫紀錄與失敗）
- `/admin/content` 內容池（主動訊息/每日一句/驚喜，依 kind 分組）
- `/admin/flags` Feature Flags —— **可即時切換**（PATCH `/api/admin/feature-flags`，樂觀更新+回滾）+ space 覆寫唯讀
- `/admin/spaces` Space／使用者總覽（空間/擁有者/成員數/隱私/狀態 + 使用者/登入方式/語系）
  刪除·停用刻意不放這裡 —— 走使用者自己的資料權流程（設定→危險區）。
- hub 補齊全部連結、移除「規劃中」。

## ✅ Lottie 動畫背景（Luffy 選「內建 CC0 素材」）

- **誠實取捨**：第三方「免費」Lottie 多為 Lottie Simple License 非 CC0、且授權無法在此可靠核實
  → 改用生成器自製 5 個（極光/氣泡/光環/花瓣/星塵），專案自有 → 授權明確。
- `scripts/build-lottie.mjs` 生成動畫 + `manifest.json`（底色屬動畫內容 → 放資料檔而非 .ts，
  避免寫死顏色）。`pnpm lottie:build` 可重生。只用最可靠子集（shape + transform keyframe）。
- **驗證抓到真 bug**：以 jsdom + 真實 lottie-web(light) 逐格掃描渲染，發現純線性 keyframe 缺
  i/o 貝茲把手會在 `interpolateValue` 讀 undefined.x → renderFrameError。補 ease-in-out 把手後，
  5 個動畫全程無錯。（jsdom 僅為驗證臨時裝，用完移除。）
- 前端 `LottieBackground`：懶載入 lottie-web light（不進主 bundle）；reduced-motion／省流量只停第一格；
  接背景暫停鈕。BackgroundLayer / 編輯器預覽 / 縮圖 / Studio 選單全接上。
- **DB 0037**：`type='lottie'` + `lottie_id` 欄 + 來源一致性約束（drop/recreate
  `background_items_type_check` 與 `bg_source_check`）。本地 + hosted 均已套。types 已重生、無漂移。
- validation：type 白名單加 lottie + lottieId 必填 + 反向測試。

## 🔎 收尾驗證（「API / DB / UI 有沒有接對」）

- **閘門**：typecheck / lint / `pnpm test`(exit 0) / check:deps(311 模組) / check:secrets(400 檔) /
  check:rls(49 表) 全綠；型別無漂移。
- **DB↔API**：把 12 張表 + 各 admin/API 實際 select 的欄位直打本地 DB（`select … limit 0`）逐一驗證存在；
  type check 約束確認含 `'lottie'`。全 OK。
- **路由**：12 個 admin hub 連結逐一確認有對應 `page.tsx`；新 API 路由存在。
- **UI/資產**：Lottie manifest / 檔案 / loader keys 三者一致、所有動畫 JSON 可解析；
  `LottieBackground`、`FlagsAdmin` 的 import 使用點確認。

---

## ⏳ 卡在外部輸入（我沒法在不造假下往下做）

- **設計分析（深/淺）、Agent SSE 串流、Insight LLM 升級** → 需 AI 金鑰（`/admin/ai-keys` 貼 Groq + Gemini）。
- **全站 RWD 逐頁視覺打磨** → 需截圖，或接上瀏覽器擴充（目前擴充未連上）讓我實走。

---

## ✅ 續：RWD 導覽重構 + 隨手記存 DB + 場景擴充 + 快取清除（0725 下午）

Luffy 指出手機 header 沒有漢堡、連結一整排換好幾行；桌機要收合側邊欄；且要展開收合動畫。

- **響應式導覽（`SpaceShell.tsx`）**：抽出互動外殼 client 元件。
  - 桌機／筆電：左側**可收合側邊欄**，展開圖示＋文字 ↔ 收合純圖示軌道（10 個自製 stroke 圖示），
    收合狀態記 localStorage；`@property --sb` 讓 grid 欄寬平滑過渡。
  - 手機／平板：頂列**漢堡**，側邊欄變左滑抽屜，連結逐項**時間差**淡入（`--i * 35ms`），
    點連結／背景遮罩／Esc 皆關閉，開啟時鎖背景捲動。
  - `usePathname` 補 `aria-current` 高亮；`prefers-reduced-motion` 與 `--sr-motion-intensity` 皆降級。
  - 移除舊 `.sr-nav*`（flex-wrap 會撐寬 header → 行動瀏覽器縮放整頁，CLAUDE.md #5）。
- **隨手記存 DB**：新增 `widget_notes` 表（0038，RLS by space_id，FK widget_instances 連帶清除），
  `GET/PUT /api/widgets/[instanceId]/note` 走 getDb() 受 RLS；widget 改防抖自動存雲端，
  狀態誠實（載入／儲存／已同步／失敗 danger 色）。**本地 + hosted 均已套並重生 types、reload schema。**
- **場景擴充**：`lib/scenes.ts` 追加 19 個（沿用既有 behavior×shape×配色，資料驅動實際會渲染），約 48 → 67。
- **回應快取可清除**：`/admin/ai/cache` 加清除動作（`DELETE /api/admin/ai-cache?mode=expired|all`，
  site-admin gated，全清二次確認）。原本只能看命中率。
- 閘門全綠：typecheck / lint / test / check:deps(313) / check:secrets(402) / check:rls(49)。

---

## 📌 給 Luffy 的動作清單

- 已完成：`pnpm db:migrate`（**0038 已上 hosted**，Luffy 授權我直接跑）✅
- 待辦：貼 AI 金鑰、RWD 實機截圖確認；對外開放前換 JWT secret、robots 改 index。
- 剩餘 Bucket A：見下方「續 2」後更新。

---

## ✅ 續 2：Bucket A — 管理後台三個「唯讀→可編輯」（0725 晚）

Luffy：「繼續往 Bucket A 清單做」。

- **每日額度上限可設定**：新增 `ai_quota_config` 單列全域表（0039，RLS 零 policy = service role）。
  `deps.ts` 的 budget 改讀設定（讀取失敗退回內建 300/20，不擋呼叫）。`/admin/ai/quota` 加編輯表單
  ＋ `PATCH /api/admin/ai-quota-config`。本地＋hosted 均已套。DB round-trip 驗證過。
- **候選鏈可編輯**：`/admin/ai/candidates` 原本唯讀且把 `{model,role}` 物件 `String()` 成 `[object Object]`。
  改成列出全部 18 用途、合併 DB 覆寫與 `DEFAULT_CANDIDATES` 顯示效果鏈，可 ▲▼ 調序／啟用覆寫／
  重設回預設（`PATCH`/`DELETE /api/admin/ai-candidates`，upsert / 刪除還原）。只重排既有候選、不改 model 字串。
- **內容池可審核**：`/admin/content` 每則加啟用/停用（樂觀更新+回滾，`PATCH /api/admin/content`）。
  停用文案不再被主動訊息／每日內容抽中。〔新增文案/編輯權重/生日鏈編輯仍待做〕
- 閘門全綠：typecheck / lint / check:deps(319) / check:secrets(408)。DB migration 到 **0039**。

**剩餘 Bucket A**（尚未動）：FORBIDDEN_PATTERNS 搬 DB 可編輯、內容池新增/編輯、Space 佈建/孤兒修復、
站台管理員 DB 角色、整合狀態頁、回應快取 per-usage 失效、本地設計分析擴充（對比/文字區亮度）、
主動訊息改時區 cron、Insight 軟刪除 upsert、lefthook、Next standalone、91-backlog 重新盤點、
widget projectId 選擇器、lib 單元測試補強。
