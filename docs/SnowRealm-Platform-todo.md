# SnowRealm Platform — 整合待辦

> 建立 2026-07-24。來源：`docs/SnowRealm-Platform-Planning.md`（平台憲章）+ `docs/ecosystem-strategy.md`。
>
> **這份的範圍**：把七個產品綁成一個平台的**跨產品**工作。
> **不含**：SnowRealm Space 自己的產品待辦（那些在 `docs/spec/91-backlog.md`）。
>
> **現況**：平台整合 **尚未開始**。優先把 Space 這個產品做完，平台工作依下面順序分批啟動。
> **原則**：絞殺式（strangler-fig）——先抽一個能力、跨兩個產品驗證、再抽下一個。**不要大爆炸重寫。**

---

## 🚦 必須先由 Luffy 拍板（擋住後面所有事）

- [ ] **身份真相來源**：SSO 由哪個產品/專案發證？（一個 Supabase 專案當 issuer，其餘當 client）。AI 島？還是新開專用 auth 專案？
- [ ] **AI Dot 定價表**：一次呼叫扣幾點 —— 需要「模型 × token → Dot」成本對照（免費模型 vs 付費模型分開）。
- [ ] **MD2Deck / TamonRadar 定位**：這兩個不在 Space repo，我沒讀過，要先看或由你一句話定位才能排整合。
- [ ] **Z 幣提現/創作者分潤的金流與稅務合規**：擴大前先確認法遵。
- [ ] **平台技術契約**：共用能力一律走 **HTTP API + 各語言薄 SDK**（因為毛行天下是 Express、YukiBoard 是 Android，不能用共用 npm 套件）。← 這條若定錯，Android/Express 產品接不進來。

---

## 第 1 批：AI Router + AI Dot（最高槓桿，經濟核心）

> 目標：一把 master key、免費模型優先、跨產品扣 Dot。先讓 **AI 島 + Space** 共用。

- [ ] 把 `@snowrealm/ai-core` 抽成**獨立 HTTP AI Router 服務**（不是 npm 套件）
  - [ ] 端點：completeForUsage、串流、vision；沿用候選鏈 + 熔斷器 + 免費優先
  - [ ] Provider/模型/金鑰集中管理（已有 `/admin/ai-keys` 後台當雛形）
  - [ ] 依成本與難度自動切換模型（憲章 §AI Router）
- [ ] **AI Dot ledger 服務**（與 Z 幣共用同一個雙分錄帳本，兩種帳戶）
  - [ ] append-only、餘額 = 加總、扣款**冪等**（同一次 AI 呼叫不重複扣）
  - [ ] 每月重置 job、可加購、與 Z 幣分離
  - [ ] AI 呼叫前檢查餘額 → 扣點 → 不足時降級/擋下（接 AI Router）
- [ ] Space 接上共用 AI Router（先驗證）
- [ ] AI 島接上共用 AI Router（第二個驗證）
- [ ] 成本/用量儀表板（跨產品；接現有 `ai_usage_log`）

## 第 2 批：身份與會員

- [ ] **SSO**：單一登入跨 snowrealm.pet 子網域（發證方見上面拍板項）
- [ ] **一個帳號**：跨產品共用 user 身份
- [ ] **SnowRealm+**（取代各產品 Pro）：一張會員解鎖整個平台能力
  - [ ] 權益服務（entitlement）——各產品查詢「這人是不是 +」
  - [ ] 先涵蓋 AI 島 + Space
- [ ] **Trust Level**（L0 註冊 / L1 Email / L2 Email+手機 / L3 SnowRealm+）
  - [ ] 免費 AI Dot 發放綁 Trust Level（這是免費運算的**反濫用**閘門）

## 第 3 批：Z 幣經濟與新手流程

- [ ] **Z 幣錢包**（與 AI Dot 同 ledger 服務，累積型帳戶）
  - [ ] 取得：每日登入、完成課程、分享、Marketplace、活動
  - [ ] 用途：主題、貼圖、Marketplace、課程、Agent 模板、數位商品
- [ ] **新手流程**：建帳號送約 50 AI Dot 體驗
  - [ ] 任務給 Dot：Email 驗證、手機驗證、新手教學、第一個 Agent、第一個 AI 任務
- [ ] **創作者販售**：創作者上架數位商品賺 Z 幣（牽涉上面的金流合規拍板）

## 第 4 批：其餘共用平台能力（依需求剝離）

> 依「哪個產品先需要」剝離，不用一次做完。Space 是幾項的最佳參考實作。

- [ ] **Theme** 共用（Space 的 `--sr-*` token 系統當種子 → 平台設計語言）
- [ ] **Agent** 共用（Space 的 agent-core + tools 當種子）
- [ ] **Memory** 共用（Space 的 pgvector memory 當種子）
- [ ] **Storage**：Cloudflare R2、平台控 quota、所有產品共用（Space 的 StorageAdapter 當種子）
- [ ] **Notification** 共用
- [ ] **Search** 共用
- [ ] **Analytics** 共用

## 第 5 批：兩兩產品的搭配玩法（來自 ecosystem-strategy）

- [ ] **Space × 毛行天下**：Space「寵物版」——記住毛孩的私人空間（照片/時間軸/里程碑/記得毛孩的 AI）。用毛行天下受眾驗證情感付費 ★最被低估
- [ ] **YukiBoard × Space**：鍵盤語音 → 直接寫進 Space 每日循環（隨處捕捉 → 沉澱進私人空間）★分發王牌
- [ ] **AI 島 × Space**：AI 島成就/作品集/筆記 → 回流成 Space 時間軸/記憶；Space 創作 → 發佈到 AI 島社群
- [ ] **Insight × 全部**：一支「生態導引測驗」分派流量到各產品，量測轉換；ERP 洞察升級成全生態分析
- [ ] **毛行天下 × Space**：「送一個 Space」當電商商品；Space 內推薦毛行天下用品（分潤）

---

## 建議的 90 天第一步（濃縮）

1. `ai-core` → 獨立 AI Router HTTP 服務 + AI Dot ledger，AI 島 + Space 先共用。
2. Insight 出「生態導引測驗」量轉換。
3. Space 寵物版 MVP，接毛行天下受眾測付費。
4. SnowRealm+ 統一涵蓋 AI 島 + Space。

> 每一條假設都要掛一個「怎麼證明對/錯」的量測。
