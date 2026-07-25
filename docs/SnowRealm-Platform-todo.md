# SnowRealm Platform — 整合待辦

> 建立 2026-07-24。**2026-07-26 依七產品實地調查改寫。**
> 來源：`docs/SnowRealm-Platform-Planning.md`（平台憲章）+ `docs/ecosystem-strategy.md`。
>
> **這份的範圍**：把七個產品綁成一個平台的**跨產品**工作。
> **不含**：SnowRealm Space 自己的產品待辦（那些在 `docs/spec/91-backlog.md`）。
>
> **現況**：平台整合 **尚未開始**。優先把 Space 這個產品做完，平台工作依下面順序分批啟動。
> **原則**：絞殺式（strangler-fig）——先抽一個能力、跨兩個產品驗證、再抽下一個。**不要大爆炸重寫。**
>
> **⚠️ 定調（實地調查後最重要的一句）**：平台能力**不是綠地**。AI Router 已有 5 套、Z 幣 4 套、
> 各產品都有自己的 Auth／quota。所以每一批的動詞是**「收斂／抽取既有最佳實作」**，不是「從零建置」。
> 詳見 Planning.md 的「平台能力已被 fork 4–5 次」一節。

---

## 🚦 必須先由 Luffy 拍板（擋住後面所有事）

- [ ] **身份真相來源（唯一真正的綠地決策）**：SSO 由誰發證？
      候選（皆為現有雛形）：Insight `tenant_users`＋JWT（最接近多租戶發證方）／AI 島 Supabase（已有 Google＋LINE）／新開專用 auth 專案。
- [ ] **AI Dot 定價表**：一次呼叫扣幾點——需要「模型 × token → Dot」成本對照（免費模型 vs 付費模型分開）。
      參考：多聞 `ai.py`、Insight `ai_cost_log`、AI 島 `ai_usage_models` 都已在記 per-user 成本，可抽定價基準。
- [x] ~~**MD2Deck / TamonRadar 定位**：沒讀過~~ → **已調查完成（2026-07-26）**。
      - **MD2Deck**：零後端純前端「檔案 → 單檔閱讀站」轉換器。定位＝生態的**發佈／匯出層**（單向吃內容，不上傳，隱私安全）。
      - **多聞雷達**：FastAPI＋Selenium 爬蟲情報站（比價／watcher／AI 摘要）。定位＝生態的**外部內容來源／興趣 feed 供給者**。
- [ ] **Z 幣提現／創作者分潤的金流與稅務合規**：擴大前先確認法遵（AI 島已接 ECPay/NewebPay/Stripe、毛行天下有 wallet 防作弊，可當合規起點）。
- [ ] **平台技術契約**：共用能力一律走 **HTTP API + 各語言薄 SDK**。
      毛行天下＝Express、多聞＝FastAPI(Python)、YukiBoard＝Android(Kotlin)——不能用共用 npm 套件。← 這條若定錯，非 JS 產品接不進來。

---

## 第 1 批：AI Router + AI Dot（最高槓桿，經濟核心）

> 目標：一把 master key、免費模型優先、跨產品扣 Dot。先讓 **AI 島 + Space** 共用。
> **這批是收斂，不是新建**——5 套現成 router 挑一套當種子。

- [ ] **選種子**：AI 島 `ai-router.ts`+`resolve-usage-ai.ts`（最成熟：候選鏈＋熔斷器＋低信心升級）
      或 Space `@snowrealm/ai-core`（架構最乾淨、ADR 已定）。二選一，其餘四套改呼叫它。
- [ ] 把種子抽成**獨立 HTTP AI Router 服務**（不是 npm 套件）
  - [ ] 端點：completeForUsage、串流、vision；沿用候選鏈 + 熔斷器 + 免費優先
  - [ ] Provider/模型/金鑰集中管理（Space 後台已有完整雛形：`/admin/ai-keys`、
        `/admin/ai/models`、`/admin/ai/candidates`、`/admin/ai/usage`、`/admin/ai/quota`、
        `/admin/ai/cache` —— 抽 Router 服務時直接沿用這套 UI）
  - [ ] 依成本與難度自動切換模型（憲章 §AI Router）
- [ ] **AI Dot ledger 服務**（與 Z 幣共用同一個雙分錄帳本，兩種帳戶）
  - [ ] append-only、餘額 = 加總、扣款**冪等**（同一次 AI 呼叫不重複扣）——參考 AI 島 `coin_transactions` 冪等訂單
  - [ ] 每月重置 job、可加購、與 Z 幣分離
  - [ ] AI 呼叫前檢查餘額 → 扣點 → 不足時降級/擋下（接 AI Router）
- [ ] Space 接上共用 AI Router（第一個驗證；Space `ai-core` 現有 `completeForUsage` 是最小改動介面）
- [ ] AI 島接上共用 AI Router（第二個驗證）
- [ ] 成本/用量儀表板（跨產品；接各產品現有 usage log：Space `ai_usage_log`、Insight `ai_cost_log`、多聞 per-user cost）

## 第 2 批：身份與會員

- [ ] **SSO**：單一登入跨 snowrealm.pet 子網域（發證方見上面拍板項）
  - [ ] 收斂目標：AI 島（Google+LINE）、多聞（Google）、YukiBoard（已接 Insight SSO）、毛行天下（provider 欄位）各自的 OAuth → 統一發證方
- [ ] **一個帳號**：跨產品共用 user 身份（各產品 profile 對應同一 issuer sub）
- [ ] **SnowRealm+**（取代各產品 Pro）：一張會員解鎖整個平台能力
  - [ ] 權益服務（entitlement）——各產品查詢「這人是不是 +」
  - [ ] 要**取代**：AI 島 Pro（NT$149/mo）、YukiBoard 付費、毛行天下付費
  - [ ] 先涵蓋 AI 島 + Space
- [ ] **Trust Level**（L0 註冊 / L1 Email / L2 Email+手機 / L3 SnowRealm+）
  - [ ] ⚠️ 全新層——目前無任何產品實作
  - [ ] 免費 AI Dot 發放綁 Trust Level（這是免費運算的**反濫用**閘門）

## 第 3 批：Z 幣經濟與新手流程

> **收斂 4 套帳本**：AI 島 `coin_transactions`（種子）/ Insight `zcoin_economy_v2` / 毛行天下 `wallets` / YukiBoard Supabase 餘額。

- [ ] **Z 幣錢包**（與 AI Dot 同 ledger 服務，累積型帳戶；種子＝AI 島 ADR-003）
  - [ ] 取得：每日登入、完成課程、分享、Marketplace、活動
  - [ ] 用途：主題、貼圖、Marketplace、課程、Agent 模板、數位商品
  - [ ] 遷移：其餘 3 套帳本餘額 → 統一帳本（一次性對帳 + 切換）
- [ ] **新手流程**：建帳號送約 50 AI Dot 體驗
  - [ ] 任務給 Dot：Email 驗證、手機驗證、新手教學、第一個 Agent、第一個 AI 任務
- [ ] **創作者販售**：創作者上架數位商品賺 Z 幣（牽涉上面的金流合規拍板）
  - [ ] 種子＝AI 島創作者島 `ci_listings` + `ci_workspace_wallet`

## 第 4 批：其餘共用平台能力（依需求剝離）

> 依「哪個產品先需要」剝離，不用一次做完。括號內為最佳收斂種子。

- [ ] **Theme** 共用（種子：Space `--sr-*` token 系統 → 平台設計語言）
- [ ] **Agent** 共用（種子：AI 島分身島 `agent_tasks/steps/approvals` + Space agent-core/tools）
- [ ] **Memory** 共用（種子：AI 島 `agent_memory`/`ci_memories` embeddings + Space pgvector）
- [ ] **Storage**：Cloudflare R2、平台控 quota（種子：Space `StorageAdapter`；多聞已用 R2）
- [ ] **Notification** 共用（種子：多聞已有 Discord/Telegram/Web Push）
- [ ] **Search** 共用
- [ ] **Analytics** 共用（種子：Insight DAU/WAU/MAU + AI 成本；多聞 admin KPI）

## 第 5 批：兩兩產品的搭配玩法（依實測可行性排序）

- [ ] **Space × 毛行天下（寵物版 / 送一個 Space）★最可行、已半成品**
      毛行天下 `virtualPets`（親密度只增不減）＋ `rainbowRealms`（每隻毛孩的持久記憶空間）就是寵物版 Space 原型。
      Space 直接消費這些表；受眾（`userPets`/`userFollows`）當種子。附帶：「送一個 Space」當電商 SKU（`products`/`orders` 現成）、Space 內推薦用品分潤（`products.affiliateUrl`）。
- [ ] **YukiBoard × Space（鍵盤語音 → 每日循環）★分發王牌**
      `SpeechInputEngine`+`NextActionPredictor`（已保留呼叫 SnowRealm AI）→ quick-capture 寫進 Space 每日循環。走 YukiBoard 的 `ai-proxy`(SSE) HTTP 契約。
- [ ] **Insight × 全部（生態導引測驗）backbone**
      `quizResultEngine`+`insightEngine` 出「哪個產品適合你」測驗，UTM/funnel 分派流量到各產品並量轉換。
- [ ] **AI 島 × Space（作品/記憶回流）**
      AI 島成就/作品集 → Space 時間軸/記憶；Space 創作 → 發佈到 AI 島社群。共用 `ci_memories`/`agent_memory` embeddings。
- [ ] **多聞雷達 × Space（內容池 → 個人化 feed）**
      爬取/分類內容 + `insights.py` 聚合 → Space 每日內容池/興趣 feed；watcher/比價事件 → Space 每日循環通知。
- [ ] **MD2Deck × Space（發佈層，單向隱私安全）**
      Space 作品/專案/日誌 → `studio.html` → 品牌化 deck/EPUB/可分享閱讀站（「發佈我的 Space」）。JSON 當匯入匯出契約。

---

## 建議的 90 天第一步（濃縮）

1. **收斂 AI Router**：挑 AI 島或 Space 的 router 抽成獨立 HTTP 服務 + AI Dot ledger，AI 島 + Space 先共用。
2. **拍板 SSO 發證方**（唯一綠地決策），才能解鎖第 2 批。
3. Insight 出「生態導引測驗」量轉換。
4. **Space 寵物版 MVP**：接毛行天下 `virtualPets`/`rainbowRealms` 與受眾，測情感付費（最被低估、最現成）。
5. SnowRealm+ 統一涵蓋 AI 島 + Space，取代兩邊各自的 Pro。

> 每一條假設都要掛一個「怎麼證明對/錯」的量測。
