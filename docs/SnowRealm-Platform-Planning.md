# SnowRealm Platform 整合規劃（給 Claude Code）

> 建立 2026-07-24。**2026-07-26 依實地調查全面改寫**——七個產品的原始碼都讀過了，
> 這份不再是空泛願景，而是「現況 → 差距 → 收斂路線」。
> 願景（核心理念、SnowRealm+、Economy、長期目標）維持不變；改的是把它接回**真實的程式碼現況**。

## 背景

SnowRealm 不再是單一產品，而是一個 Platform，底下七個產品：

| 產品 | 一句話 | 路徑 |
|---|---|---|
| **AI 島** | 免費 80 章程式/AI 養成營（RPG 化）＋創作者島／機會島／分身島 | `D:\SnowRealmRebirth\AI\ai_island_v3` |
| **SnowRealm Space** | 會隨長期使用成長的私人數位空間 | `D:\SnowRealmRebirth\SnowRealmSpace` |
| **Insight Engine** | 以問卷為入口、CRM 為中樞、AI 洞察為管理層的成長引擎 | `D:\SnowRealmRebirth\snowrealm-insight-engine\insight-engine` |
| **YukiBoard** | 動畫 Android 輸入法（Lottie 角色＋語音／翻譯／遠端鍵盤） | `D:\SnowRealmRebirth\SnowRealmYukiBoard` |
| **MD2Deck** | 零後端、純瀏覽器的「檔案 → 單檔閱讀站」轉換器 | `D:\SnowRealmRebirth\md2deck` |
| **多聞雷達** | 關鍵字 → 即時爬取 → 商品情報／比價／AI 摘要 | `D:\SnowRealmRebirth\tammon_crawler_project` |
| **毛行天下** | 寵物情感社群＋電商，自我定位為生態的「母艦／試驗場」 | `D:\SnowRealmRebirth\snowrealm-pet\MaoTravelBlog` |

目標不是產品數量，而是產品彼此正相關、互補、互相增強。

## 核心理念（不變）

- 每個產品都能提升其他產品價值。
- 新產品加入要讓整個平台更強。
- 共用 Platform 能力，不重複造輪子。

任何新產品至少符合：1. 使用既有 Platform 能力。2. 回饋至少一個既有產品。

---

## ⚠️ 最關鍵的現況：平台能力不是綠地，是「已經被 fork 了 4–5 次」

實地調查最重要的一個發現：**憲章裡「共用」的每一項能力，其實各產品都已經各自造了一套。**
所以平台工作的本質是 **收斂（consolidate / 抽取既有最佳實作）**，不是**建置（從零蓋）**。

### AI Router — 目前有 5 套，設計都很像

| 產品 | 實作 | 特徵 |
|---|---|---|
| AI 島 | `ai-router.ts` + `resolve-usage-ai.ts` | 候選鏈、熔斷器、低信心升級、免費優先、BYOK ★**最成熟** |
| Space | `@snowrealm/ai-core`（`completeForUsage`） | 候選鏈、免費優先、usage-key、ADR 乾淨 ★**架構最乾淨** |
| Insight | `aiCall.ts` / `aiService.ts` | per-tenant 加密金鑰、平台免費層、`ai_cost_log` 計費 |
| 多聞雷達 | `ai.py`（Python） | OpenAI-compatible 換 base_url、per-user 成本、每日 quota |
| 毛行天下 | `aiOrchestrator.ts` + `aiPolicies` | primary/fallback、預算、rate limit（OpenAI-scoped） |

→ **收斂種子**：AI 島（最成熟）或 Space（最乾淨）。抽成獨立 HTTP 服務，其餘四套改成呼叫它。

### Z 幣 — 目前有 4 套獨立帳本

| 產品 | 實作 | 備註 |
|---|---|---|
| AI 島 | `profiles.z_coin` + `coin_transactions`（**ADR-003**） | 已明文定位 Z 幣為「平台經濟」、單一單位、NT$1=10Z、冪等訂單、3 個金流 ★**最適合當種子** |
| Insight | `zcoin_economy_v2` | 問卷/分享/邀請賺、AI/模板/主題花 |
| 毛行天下 | `wallets` + `transactions` | 有號誌防作弊；docs 標記要抽到 `core/economy/` |
| YukiBoard | Supabase Z 幣餘額／商店／排行榜 | 用 NewebPay 儲值 |

→ **收斂種子**：AI 島 ADR-003（唯一已把 Z 幣當「平台貨幣」設計的）。

### SSO / 身份 — 目前各自為政，沒有跨產品發證方

- AI 島：Supabase Auth（Email＋Google＋LINE OAuth）、`ensure-profile` 自動建檔
- Insight：`tenant_users` 多租戶＋JWT＋`superAdminAuth`（最接近「發證方」的雛形）
- 多聞雷達：JWT＋Google OAuth
- 毛行天下：`users.provider` / `providerId`（OAuth 欄位已在）
- Space：Supabase Auth（magic link），目前用 uuid 綁 owner/admin

→ 沒有任何一個現在是跨子網域發證方。**這是唯一真正需要「拍板 + 新建/指定 issuer」的能力**（其餘都是收斂既有）。

---

## Platform（共用能力）

SnowRealm = Platform。產品只是 Platform 上的應用。

共用：SSO、Theme、Agent、AI、Memory、Notification、Search、Analytics、Storage。

**技術契約（不可違反）**：共用能力一律走 **HTTP API + 各語言薄 SDK**。
因為毛行天下是 Express、多聞是 FastAPI(Python)、YukiBoard 是 Android(Kotlin)——
**不能**假設共用一個 npm 套件。憲章這條若定錯，非 JS 產品接不進來。

各能力的**最佳收斂種子**（實地調查後）：

| 能力 | 種子（現有最佳實作） |
|---|---|
| AI Router | AI 島 `ai-router` / Space `ai-core` |
| Z 幣 / Economy | AI 島 ADR-003 `coin_transactions` |
| SSO issuer | 待拍板（Insight `tenant_users` 或 AI 島 Supabase 或新開專用） |
| Theme | Space 的 `--sr-*` token 系統 |
| Agent | AI 島分身島（`agent_tasks/steps/approvals`）＋ Space agent-core／tools |
| Memory | AI 島 `agent_memory`／`ci_memories` embeddings ＋ Space pgvector |
| Storage | R2；Space `StorageAdapter`、多聞已用 R2 |
| Analytics | Insight（DAU/WAU/MAU、AI 成本）、多聞 admin KPI |

## SnowRealm+（不變）

不要做各產品 Pro，改成 **SnowRealm+**：一張會員解鎖整個平台能力。
（注意：AI 島現有 Pro NT$149/mo、毛行天下／YukiBoard 各有自己的付費——SnowRealm+ 要**取代**它們。）

## Economy（不變的設計，落地要收斂）

### AI Dot（AI 運算資源）
用途：AI 聊天／生成／分析／Agent／翻譯／摘要／寫程式。
特性：每月重置、可加購、**與 Z 幣分離**。
> 現況：各產品是用「每日 quota／免費層」控管（多聞、Insight、AI 島都有），**還沒有統一的 Dot 帳本**。這是要新做的收斂層。

### Z 幣（平台貨幣）
用途：主題／貼圖／Marketplace／課程／Agent 模板／數位商品。
特性：可累積、任務取得、創作者販售獲得。
> 現況：4 套帳本要合一（見上）。

## 新手流程 / Trust Level / 任務（不變）

- 新帳號：可登入、可瀏覽、送約 50 AI Dot 體驗。
- 更多 Dot：Email 驗證、手機驗證、新手教學、第一個 Agent、第一個 AI 任務。
- Trust Level：L0 註冊 / L1 Email / L2 Email+手機 / L3 SnowRealm+。免費 Dot 發放綁 Trust Level（反濫用閘門）。
- 任務給 Z 幣：每日登入、完成課程、分享、Marketplace、活動。
> 注意：目前**沒有任何產品實作 Trust Level**（AI 島只有 OAuth trust 參照）。這是全新層。

## AI Router（統一管理）

Provider／模型／Token／成本／AI Dot，依成本與難度自動切換模型。
→ 見上面「AI Router 有 5 套」；收斂而非新建。

## Storage

Cloudflare R2、Platform 控 quota、所有產品共用。Space `StorageAdapter` 當種子；多聞已在用 R2。

## 長期目標（不變）

- 一個帳號 / 一個會員 / 一套 AI Dot / 一套 Z 幣 / 一套 Platform
- 全產品互補、互相增強

---

## 產品兩兩搭配（實測可行性）

實地調查後對 `ecosystem-strategy` 幾個賭注的可行度評估：

- **Space × 毛行天下（寵物版 / 送一個 Space）— ★最可行、已半成品。**
  毛行天下的 `virtualPets`（親密度只增不減的數位分身）＋ `rainbowRealms`（每隻毛孩一個持久記憶空間，含暱稱／最愛／信／燈）**本身就是「寵物版 Space」的原型**。Space 可直接消費這些表；受眾（`userPets`／`userFollows`）就是種子名單。
- **YukiBoard × Space（鍵盤 → 每日循環）— 分發王牌。**
  `SpeechInputEngine` + `NextActionPredictor`（已保留呼叫 SnowRealm AI）可把鍵盤語音／文字當 quick-capture 直接寫進 Space 每日循環。YukiBoard 已有 Insight SSO 與 `social/share`。
- **AI 島 × Space（作品／記憶回流）— greenfield 但錨點清楚。**
  AI 島無 Space 程式碼；接點：共用 Z 幣（ADR-003）、共用 AI-core、`ci_memories`／`agent_memory` embeddings 當共享記憶、雪鑰 persona 映射 Space 個人 agent、PWA `share_target` 當資料入口。
- **Insight × 全部（生態導引測驗）— backbone。**
  `quizResultEngine.ts` + `insightEngine.ts` 就是「哪個產品適合你」的測驗／漏斗；用 UTM/funnel 把人導去各產品並量轉換。其 `aiCall.ts` 與 `zcoinEngine.ts` 是現成的 AI Router／Z 幣參考實作。
- **多聞雷達 × Space（內容池 → 個人化 feed）— 可行。**
  爬取／分類內容池＋`insights.py` 聚合可餵 Space 每日內容池或興趣 feed；watcher／比價事件 → Space 每日循環通知。
- **MD2Deck × Space（發佈層）— 單向、隱私安全。**
  Space 的作品／專案／日誌 → 灌進 `studio.html` 產生品牌化 deck／EPUB／可分享閱讀站（「發佈我的 Space」）。MD2Deck 零後端不上傳，隱私不外洩；JSON 是乾淨的匯入匯出契約。

---

**執行原則：以 Platform 優先，但用絞殺式收斂——先抽一個能力、跨兩個產品驗證、再抽下一個。不要大爆炸重寫。**
細部批次與可執行待辦見 `SnowRealm-Platform-todo.md`。
