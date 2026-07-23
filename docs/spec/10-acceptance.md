# Milestone 驗收條件

> 實作 ADR-001：無硬期限，每個 Milestone 必須有可用閉環。
> v1.0 §55 的 Definition of Done 是一份 23 項的平坦清單，無法判斷「現在做到哪」。本檔把它拆進 Milestone 並加上可驗證的條件。

---

## 0. 閉環定義

一個 Milestone 通過的條件：

> **一位不知道實作細節的人，能在不看文件的情況下用 UI 完成該 Milestone 宣稱的事，並在重新整理後看到結果被保留。**

每個 Milestone 都有：
- **閉環敘述** —— 一句話說明使用者能完成什麼
- **功能條件** —— 逐項可勾選
- **品質閘門** —— 每個 Milestone 都一樣，不可跳過
- **不做什麼** —— 明確劃界，防止範圍蔓延

---

## 通用品質閘門（每個 Milestone 都必須通過）

| # | 條件 |
|---|---|
| Q1 | `pnpm lint` `pnpm typecheck` `pnpm test` 全綠 |
| Q2 | 該 Milestone 新增的每張表都有 RLS policy，且有跨 space 拒絕測試（ADR-017） |
| Q3 | 該 Milestone 新增的每個 API 端點都有 4 個測試：成功 / 驗證失敗 / 未認證 / 越權 |
| Q4 | 該 Milestone 的主要頁面通過 axe-core，0 個 critical / serious violation |
| Q5 | 主要流程有 Playwright E2E 測試 |
| Q6 | 沒有假按鈕：所有可見的可互動元素都有實際行為，或明確標示為未啟用並停用 |
| Q7 | 未完成的功能藏在 feature flag 之後，且 flag 關閉時路由與 API 都回 404（ADR-018） |
| Q8 | 該 Milestone 新增的環境變數已加入 `.env.example` 與 `11-engineering-setup.md` |
| Q9 | 錯誤狀態有 UI：載入中、空狀態、錯誤、無權限四種都有設計 |
| Q10 | 手動走過一次 Milestone 的閉環敘述，全程不需要開 DevTools |

---

## Milestone A — Foundation

**閉環：** 受邀者能收到 magic link、登入、看到一個屬於自己的空 Space，登出再登入資料仍在。

### 功能條件
- [ ] pnpm + Turborepo monorepo 可建置，`apps/web` 與 `apps/worker` 皆可啟動
- [ ] Supabase 專案建立，migration `0001`–`0003` 可重複執行（冪等）
- [ ] `space_invites` 建立與驗證流程可用（CLI 腳本產生邀請即可，不需 UI）
- [ ] Magic link 登入、登出、session 持久化
- [ ] 未受邀 email 無法完成註冊
- [ ] 登入後自動建立第一個 space 與 `space_settings`、`agent_profiles`
- [ ] `is_space_member` / `is_space_owner` 函式建立，且 RLS 測試通過
- [ ] R2 bucket 建立，`StorageAdapter` 介面完成，signed URL 產生與驗證可用
- [ ] `activity_events` 寫入機制與 `emit()` 完成，`space.opened` 有實際寫入
- [ ] `audit_logs` 寫入機制完成
- [ ] pg-boss 啟動，一個測試 job 可以入列並被 worker 消費
- [ ] Feature flag 讀取機制完成，關閉的 flag 讓路由回 404
- [ ] Space Shell：導覽列 + 空的 Home + Settings 骨架

### 不做
主題、背景、字體、Widget、上傳、Agent。這個 Milestone 的產物在視覺上會很空，**這是正確的**。

---

## Milestone B — Visual Personalization

**閉環：** 使用者能上傳背景圖、建立幻燈片、自訂顏色與字體、切換卡片材質，關掉瀏覽器再打開，空間仍是他布置的樣子。

### 功能條件

**上傳**
- [ ] 上傳意圖 → R2 直傳 → complete 三段流程完成
- [ ] MIME 以檔案內容偵測，與宣稱值不符則拒絕
- [ ] 配額檢查生效，超過回 413 並顯示用量
- [ ] checksum 去重：重複上傳同一檔案不佔用額外空間
- [ ] `asset.process` job 產生 thumbnail 與 preview
- [ ] 上傳進度、失敗、重試的 UI 完整

**Theme**
- [ ] `ThemeDefinition` 完整，`compileThemeToCssVars` 單元測試 100% 覆蓋
- [ ] Theme Studio：即時預覽、自訂全部顏色 token、圓角、模糊、邊框
- [ ] 四種 surface style（solid / glass / soft / outline）皆可切換且視覺有實際差異
- [ ] 對比檢查即時顯示比值，未達 AA 時顯示警告與具體改法（ADR-011）
- [ ] 不合格主題套用時，focus ring / 錯誤訊息 / disabled 自動 fallback
- [ ] 儲存、另存新檔、複製、刪除、還原預設
- [ ] 版本快照與還原
- [ ] JSON 匯出與匯入，匯入拒絕注入內容
- [ ] 主題切換 < 150ms，且不觸發 React 樹重渲染

**Font**
- [ ] 8 套字體 seed 完成，含授權欄位與 R2 上的 OFL.txt
- [ ] 繁中字體 unicode-range 分片產生腳本可執行
- [ ] 首屏阻塞渲染的字體 < 100 KB
- [ ] 字體選擇與配對 UI，預覽只載入該字體片 0
- [ ] 換主題時卸載不再使用的 `@font-face`

**Background**
- [ ] `background_items` 建立、編輯（fit / 位置 / 縮放 / 模糊 / 亮度 / 疊色）
- [ ] 幻燈片：新增、排序（拖曳）、刪除
- [ ] 三種轉場（fade / blur fade / zoom fade）
- [ ] 播放模式至少支援：依序、隨機、每日切換、時段
- [ ] 僅預載下一張，最多同時 2 個項目（v1.0 §12.6）
- [ ] 分頁不可見時停止影片
- [ ] `prefers-reduced-motion` 時影片降級為 poster frame
- [ ] 影片有可見的暫停控制

**Layout**
- [ ] 三斷點格線系統，desktop 12 欄 / tablet 8 欄 / mobile 單欄
- [ ] 拖曳、調整大小、隱藏、鎖定
- [ ] 碰撞推擠與重力壓縮（`compactLayout` 100% 測試覆蓋）
- [ ] 斷點推導只執行一次並持久化
- [ ] 鍵盤可完成全部拖曳操作，並有 aria-live 播報
- [ ] Layout preset 儲存與切換
- [ ] Widget 錯誤隔離：單一 widget 崩潰不影響其他，且保留格線位置

### 不做
Agent、AI 生成主題、作品分析、Timeline、Daily。此時 Home 上的 widget 可以是靜態的展示卡片。

---

## Milestone C — Creative Core

**閉環：** 使用者能建立專案、上傳作品、把作品設為背景、從作品一鍵生成主題並套用。

### 功能條件
- [ ] Project CRUD、狀態、封面、tag
- [ ] `design_files` + `design_snapshots` 建立（從既有 asset）
- [ ] Creative Library：列表、篩選（類型 / project / tag / 日期）、搜尋（pg_trgm）
- [ ] Asset actions：預覽、改名、加 tag、收藏、移動、封存、刪除、設為背景、建立主題、指派專案
- [ ] 刪除 asset 前檢查引用，有引用回 409 並列出引用清單與連結
- [ ] `cascade=true` 可一併刪除引用
- [ ] 軟刪除 + 30 天寬限 + `asset.purge` job
- [ ] `asset.analyze_local`：k-means 取色（CIELAB、固定種子）、對比、留白比例、textZoneLuminance
- [ ] `POST /api/themes/from-image` p95 < 3 秒，產生 3 個變體
- [ ] 取色可重現：同圖兩次結果完全相同
- [ ] 生成的主題保證 textPrimary 對 background ≥ 4.5:1
- [ ] 版本比較：並排、疊圖、滑桿三種模式；色彩與尺寸差異的數值呈現
- [ ] Timeline 基礎：`event.project` job 運作，投影規則與節流生效
- [ ] Timeline 檢視（時間順序 / project / On This Day）
- [ ] 每筆 Timeline 可改標題、設 visibility、刪除

### 不做
AI 分析、Agent、外部 provider。版本比較此階段只呈現本地計算的數值差異，無文字摘要。

---

## Milestone D — AI Core

**閉環：** 使用者能選取一件作品問 Agent，Agent 引用該作品的實際數據回答，能提議記住一件事，使用者按同意後下次對話 Agent 會用上它。

### 功能條件

**多模型層（`12-ai-model-routing.md`）**
- [ ] `packages/ai-core` 完成：providers / router / resolve-usage / usage-models / cache / keys
- [ ] 三種協定（OpenAI 相容 / Anthropic / Google）皆可呼叫並串流
- [ ] `stripLoneSurrogates` 套用在所有送出文字
- [ ] Anthropic prompt cache 邊界標記生效，`cache_read_tokens` 有實際數值
- [ ] 候選鏈：第一個 429 時自動換第二個，使用者無感
- [ ] Circuit breaker：連續 2 次失敗跳閘 60 秒，降到隊尾而非移除
- [ ] 低信心升級：空/過短/拒答/schema 驗證失敗皆觸發，且只升級一次
- [ ] 真錯誤（400）不觸發換模型
- [ ] 缺金鑰的候選被跳過，不計入 attempts
- [ ] `ai_usage_log` 每次呼叫都有記錄，含 is_free / fell_back / escalated
- [ ] 額度閘門：免費與付費分開計，付費用盡時降級並回傳 `degraded = true`
- [ ] 快取的 scope 隔離：跨 space 不共用非 global 內容
- [ ] 只設兩把免費金鑰（如 Groq + Gemini）也能跑完整產品

**Agent**
- [ ] `system-v1.md` 完成，含前綴/後綴切分
- [ ] Context Builder 完成，裁切優先序生效，被裁切時告知使用者
- [ ] SSE 串流，事件格式符合 `04-api-contract.md` §7
- [ ] 五分類輸出，`clampStatement` 後處理生效
- [ ] 無證據的 fact/metric 被丟棄但其餘陳述保留
- [ ] inference 的 confidence 上限 0.85 強制執行
- [ ] UI 上 inference 與 metric 有明顯視覺區別
- [ ] Agent 不描述未附上圖片的作品內容
- [ ] Agent 對未選取的作品明確說看不到，並給出提供方式
- [ ] 10 個 tool 全部有 JSON Schema 且已註冊
- [ ] `apply_theme` 與大量 `tag_asset` 要求確認
- [ ] Agent 無刪除 / 封存 / 中斷連線 / 分享 / 上傳第三方的 tool
- [ ] Undo：24 小時內可復原，`undo_payload` 正確擷取前值
- [ ] Tool calling 走付費模型，額度用盡時給替代路徑而非單純失敗
- [ ] 錯誤時保留使用者輸入 + 重試按鈕

**Memory**
- [ ] 預設關閉（ADR-014），Onboarding 詢問且預設「稍後再說」
- [ ] 關閉時 Agent 不提案、不檢索、context 不含記憶
- [ ] 提案 → 使用者同意 → approved 的完整流程
- [ ] Agent 無法直接建立 approved memory（DB constraint + API 驗證雙重）
- [ ] `restricted` 記憶永不進 context
- [ ] Memory Center：查看、編輯、刪除、全部刪除、匯出
- [ ] 關閉記憶時顯示「N 筆被保留」與刪除入口

**設計分析**
- [ ] `aiAnalysisEnabled` 預設關閉，關閉時分析端點回 403
- [ ] light 分析走免費 vision，deep 走付費且扣額度
- [ ] 本地 Metric 永遠可用且不需要 AI 同意開關
- [ ] 分析結果的每條陳述都可追溯到 sourceIds

### 不做
外部 provider、Insight Engine、主動訊息、週報。

---

## Milestone E — Daily Loop

**閉環：** 使用者每天打開空間會看到新的每日卡片與可開啟的驚喜，Agent 偶爾主動說一句有根據的話，一週後能看到一份基於實際活動的回顧。

### 功能條件
- [ ] 內容池 seed 完成，數量達 `09-content-pool.md` §3 的下限，不足則 build 失敗
- [ ] 內容全部通過安全過濾
- [ ] `daily.generate` job + 每小時 cron 掃時區
- [ ] 冪等：cron 重跑不產生重複
- [ ] 選取演算法：冷卻、tag 不連續、活躍度加權、三段降級鏈
- [ ] 24 小時後 archived，但 Archive 中永久可讀
- [ ] Surprise：稀有度機率如實實作，rare 保底計數器真實運作
- [ ] 機率公開於 `/settings/about/surprises`
- [ ] special 由里程碑條件觸發，非隨機
- [ ] 生日鏈：`availableFrom` 條件觸發，依序解鎖
- [ ] 主動訊息：觸發條件、頻率上限 3/日、Quiet hours
- [ ] `FORBIDDEN_PATTERNS` 攔截生效，被攔截的訊息不佔額度
- [ ] Insight Engine：至少 3 種 insight 類型，每筆有 evidence 與 confidence
- [ ] Insight 文案符合 v1.0 §23.5（數據描述，非空泛判斷）
- [ ] Weekly Recap（`feature.weeklyRecap`）
- [ ] Notification：in-app，分類、已讀、Quiet hours、一鍵關閉

### 不做
Email / Push 通知、外部 provider。

---

## Milestone F — Integration

**閉環：** 使用者能連接 Figma、選擇特定檔案同步，檔案更新時空間裡出現新版本並可與舊版比較。

### 功能條件
- [ ] `DesignProviderAdapter` 介面完成，Figma 為第一個實作
- [ ] `ProviderCapabilities` 宣告，前端只顯示實際支援的功能
- [ ] 未支援的功能不顯示（禁止永久 Coming Soon）
- [ ] OAuth 流程，token 加密儲存，永不回傳前端
- [ ] 明確選擇檔案，禁止預設同步整個 Team
- [ ] Webhook 簽章驗證 + 冪等（`provider_webhooks` unique）
- [ ] 3 秒內回 200
- [ ] `figma.sync` job：快取、去重、指數退避、429 依 Retry-After
- [ ] 連續 5 次失敗轉 error 並通知使用者
- [ ] UI 顯示上次同步時間
- [ ] 斷開連線時明確詢問是否刪除派生資料
- [ ] Provider mock 以錄製的真實回應建立，禁止手寫理想化 mock

### 不做
Canva、Adobe。它們在 V2（v1.0 §50）。

---

## 跨 Milestone：隱私與刪除

**這一組必須在 Milestone C 結束前完成**，不可延到最後。理由：刪除流程若最後才做，會發現前面所有功能都沒考慮 cascade，屆時是全面重構而非新增功能。

- [ ] 刪除單一 asset（含引用檢查）
- [ ] 刪除 design snapshot
- [ ] 刪除 memory（單筆 + 全部）
- [ ] 刪除 insight
- [ ] 中斷 provider + 選擇性刪除派生資料
- [ ] 刪除 space（7 天寬限、R2 先於 DB）
- [ ] 刪除帳號
- [ ] 帳號匯出（zip：原始檔 + JSON）
- [ ] 匯出後刪除的完整流程
- [ ] AI 資料聲明頁（v1.0 §32.4）
- [ ] 資料地圖頁：哪些資料存在哪裡

---

## Birthday Alpha 完成 = Milestone A–E 全數通過

對照 v1.0 §55 的 23 項 Definition of Done：

| v1.0 §55 | Milestone |
|---|---|
| 可進入私人 Space | A |
| 個人化歡迎 | A + E（生日鏈 index 0） |
| 上傳背景 / 建立幻燈片 / 調整轉場 | B |
| 自訂顏色 / 選擇字體 / 切換卡片材質 | B |
| 拖曳 Widget / 設定會保存 | B |
| 上傳作品 / 設為背景 / 從作品建立主題 | C |
| 與 Agent 對話 / Agent 能引用選取內容 | D |
| Agent 不假裝看過未提供內容 | D |
| 查看 Daily Card / 打開 Surprise | E |
| 查看 Timeline | C |
| 刪除上傳內容 | C（跨 Milestone 隱私組） |
| Desktop 與 Mobile Web 可用 | 每個 Milestone 的 Q 閘門 |
| Essential flow 無假按鈕 | Q6 |
| 未完成功能用 Feature Flag 隱藏 | Q7 |

---

## 最終驗證（v1.0 結尾）

> **使用七天後，這個空間是否比第一天更像它的主人？**

這個問題無法自動化測試。Milestone E 結束後執行一次為期七天的實際使用，並回答：

1. 第 7 天的 Home Space 截圖，與第 1 天相比，有多少視覺元素是使用者自己放的？
2. 使用者在這七天內建立了幾件無法從預設值推導出來的東西（主題、作品、專案、記憶）？
3. 若把資料庫清空重來，使用者會覺得失去了什麼？

第 3 題的答案若是「沒什麼」，則這個產品尚未通過 v1.0 的最終驗證，不論功能完成度多高。
