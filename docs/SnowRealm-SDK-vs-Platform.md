# SnowRealm：Platform（中央服務）vs SDK（可嵌入函式庫）

> 建立 2026-07-27。源自 `SnowRealm-Platform-Planning.md`（2026-07-26 實地調查版，七個產品原始碼都讀過）。
> 那份回答「哪些能力共用、收斂種子是誰」；**這份把它接到「Platform 服務 / SDK 函式庫 / 薄 client」的分界**，
> 給抽取時對照用。**執行原則：該 HTTP 就 HTTP、該 SDK 就 SDK、該 client 就 client。**

七個產品：AI 島、SnowRealm Space、Insight Engine、YukiBoard、MD2Deck、多聞雷達、毛行天下。

---

## 分界規則

最關鍵的技術契約（來自 Planning）：**共用能力走 HTTP API + 各語言薄 SDK**——
因為毛行天下=Express、多聞=Python(FastAPI)、YukiBoard=Android(Kotlin)，**不能假設共用一個 npm**。
憲章這條若定錯，非 JS 產品接不進來。由此推出判斷法：

| 特徵 | 歸類 |
|---|---|
| 有狀態、單一真相、計費、發證、跨用戶/跨語言 | **Platform（HTTP 服務）** |
| 純呈現、純函式、客戶端可獨立跑、不需中央狀態 | **SDK（函式庫）** |
| 跨語言的 Platform 能力 | **兩者都要**：HTTP 服務 + 每語言薄 client SDK |

---

## A. Platform 共用（中央 HTTP 服務，不能塞進各 app）

這些「不能」做成純 SDK——因為要單一真相 / 防作弊 / 發證。收斂而非新建（每項各產品都已 fork 過）。

| 能力 | 為何是 Platform | 收斂種子 |
|---|---|---|
| **SSO / Identity issuer** | 唯一要**新建/拍板**的發證方（現在沒人跨子網域發證） | Insight `tenant_users` / AI島 Supabase / 新開專用 |
| **AI Router** | 金鑰、成本、額度要集中；目前有 5 套 | AI島 `ai-router`（最成熟）或 Space `ai-core`（最乾淨）→ 抽成 HTTP 服務 |
| **Economy：Z 幣帳本 + AI Dot 帳本** | 錢/點數必須單一帳本、冪等、防作弊 | Z幣＝AI島 ADR-003 `coin_transactions`（4 套合一）；AI Dot＝全新收斂層 |
| **Trust Level / 反濫用 Dot 發放** | 全平台反濫用閘門；免費 Dot 綁 Trust Level | 全新層（目前無人實作） |
| **Storage quota** | R2 用量由 Platform 控 | Space `StorageAdapter`（多聞已用 R2） |
| **Memory（共享 embeddings）** | 跨產品記憶要共庫 | AI島 `agent_memory`/`ci_memories` + Space pgvector |
| **Notification / Analytics / Search** | 跨產品彙整 | Insight（DAU/WAU/MAU、AI 成本）、多聞 admin KPI |

> 注意：A 的每一項對外都是 **HTTP API**；各語言再各配一個薄 client（見 B3）。

---

## B. SDK（`pnpm add` 就能套，或每語言薄 client）

### B1. 純前端 / 純函式——真正的可嵌入 SDK（不需後端）

- **`@snowrealm/rich-editor`** — 富文本 SDK（詳見下節）。**最現成、風險最低、該先做。**
- **`@snowrealm/theme`** — `--sr-*` token + `deriveDark`/`effectiveTheme` + 字體引擎。
  Space 的 `theme-engine` 已經是純函式 package，**直接升級成 SDK 即可**。
- **`@snowrealm/ui`** — 設計系統元件（`sr-button/card/chip/dialog/mode-tabs`…）+ 那套 CSS。抽出來全平台一致。
- **MD2Deck** — 零後端轉換器本身就是「發佈 SDK」：Space 匯出 JSON → 產 deck/EPUB/可分享閱讀站。零上傳、隱私安全。

### B2. Space 已經是 package、可直接升成 SDK 的

`theme-engine`、`storage`（StorageAdapter）、`validation`、`shared-types`、`provider-core`、
`widget-engine`、`ai-core`（純路由邏輯部分）——這個 repo 的 monorepo 已把它們切乾淨，改個 scope 就能對外。

### B3. 跨語言 Platform 能力的「薄 client SDK」（wrap A 的 HTTP）

- `@snowrealm/platform-js`（TS，給 Space / AI島 / 毛行 / YukiBoard-web）
- `snowrealm_platform`（Python，給多聞）
- Kotlin client（給 YukiBoard app）

> 這些是「SDK」，但只是 A 的門面——AI Router、Economy、SSO 都經由它呼叫中央服務。

---

## 富文本 SDK：`@snowrealm/rich-editor`

> **狀態（0727 已上線第一階段）**：套件已抽出並上 workspace，`apps/web` 反過來裝它，
> 三個消費端（notes / capture / agent）改用薄包裝、行為不變，`next build` 三頁驗證通過。
> 這一階段**只搬 client 元件**（RichEditor / EmojiPicker / GifPicker / RichHtml），耦合拆兩處：
> `promptLink`（必填，web 注入 useDialog）、`giphyEndpoint`（預設 `/api/giphy`）。
> **刻意留在 web、之後再搬**：`sanitizeRichHtml`（伺服器端，避免把 Node 依賴帶進 client bundle）、
> `ChatMedia`（還綁 `/api/assets` 與聊天 UI）、`.sr-rich*` 樣式（仍靠宿主 globals.css + `--sr-*` token）。
> 下面的「套件結構 / 耦合表」是**最終目標**，非目前現況。

**為什麼它是 SDK 不是 Platform**：純前端、無狀態、客戶端可獨立跑；輸出/輸入都是 HTML 字串，
不需要中央服務。它有幾塊**不是 tiptap 原生依賴**（自刻），正是收成 SDK 的價值所在。

**功能（已在 Space 實作，與 AI 島同等，只多不少）**：
標題 H1–H3、粗/斜/底線/刪除線/行內碼、螢光筆、文字顏色、對齊、項目/編號/待辦清單、
引言、程式碼區塊（lowlight 語法高亮）、連結、圖片、表格、Markdown 貼上、字數統計，
外加自刻 **表情選擇器**、**GIF 選擇器**、**附件媒體顯示（ChatMedia：圖片/影片直接顯示、點開、下載）**。

**套件結構**：
```
packages/rich-editor/
  package.json      # @snowrealm/rich-editor；tiptap+lowlight+tiptap-markdown+sanitize-html 移進來；react 當 peer
  src/
    RichEditor.tsx  # 主編輯器
    EmojiPicker.tsx
    GifPicker.tsx
    ChatMedia.tsx   # 附件顯示（圖/影/檔）
    RichHtml.tsx    # 唯讀渲染
    sanitize.ts     # 伺服器端 sanitize（Node 專用入口）
    styles.css      # .sr-rich* 那套 CSS 隨套件出貨
    index.ts
```

**收成 SDK 的關鍵：把 3 個 app 耦合拆成參數（否則不可攜）**

| 現在寫死的 | 改成 |
|---|---|
| `useDialog()`（連結輸入） | prop `promptLink?: (msg) => Promise<string\|null>`，預設 `window.prompt` |
| `/api/giphy` | prop `giphyEndpoint = '/api/giphy'` |
| `/api/assets/[id]/url`（附件 URL） | prop `resolveAssetUrl?` |
| globals.css 的 `.sr-rich*` | 套件出 `styles.css`，消費端 import 一次 |

**apps/web 端**：改 `import { RichEditor, sanitizeRichHtml } from '@snowrealm/rich-editor'`，
包一層薄 wrapper 傳 DialogProvider 的 prompt；tiptap 依賴從 web 移到套件；
`next.config` 的 `transpilePackages` 加它；dep-cruiser 分層白名單加它；
筆記 / 捕捉 / Agent 三個消費端跟著換 import。**做完跑 `next build` 驗證三頁不壞。**

> 這也是社群 / SnowRealm Platform 動態牆的地基——貼文、留言複用同一個 `RichEditor` + `sanitize` + `ChatMedia`。

---

## 一句話結論

- **錢、身份、額度、跨用戶資料 → Platform HTTP**（AI Router、Economy/Dot、SSO、Storage quota、Memory、Analytics）
- **編輯器、主題、UI 元件、轉換器 → 純 SDK**（`rich-editor` 先行，`theme`/`ui` 次之）
- **非 JS 產品 → 每個 Platform 能力再配一個薄 client SDK**

**該 HTTP 就 HTTP、該 SDK 就 SDK、該 client 就 client。**

---

## 專案資料夾拓撲與遷移順序

**先講原則：光搬資料夾不會變成 Platform**——共用是靠「發套件 + HTTP 契約」，不是靠共同父目錄。
真正要決定的是 **repo / 套件拓撲**，不是把東西塞進一個 `Platform/` 夾。三個觀念：

1. **「Platform」不是產品的容器**，是產品「站在上面」的東西。SSO/AI Router/Economy 才是 Platform；
   Space、AI島、毛行…是跑在上面的 app。用 `Platform/` 當它們的父夾會語意混亂。
2. **不能全部一個 monorepo**：多聞=Python、YukiBoard=Kotlin 進不了 JS monorepo（正是「HTTP + 各語言薄 client」契約的由來）。
3. **搬夾子有真實成本、零實質收益**：`docs` 寫死的路徑、各專案 build/deploy 路徑、git 歷史都會受影響。

### 建議拓撲：產品各自 repo + 一個 platform monorepo

```
D:\SnowRealm\                    ← 本機整理用的傘狀夾（cosmetic，可有可無）
  snowrealm-platform\            ← 新開「一個」monorepo：共用的都在這
    packages\                    ← SDK：rich-editor / theme / ui / platform-js / ai-core…
    services\                    ← Platform HTTP：sso / ai-router / economy
    (pnpm + turbo，一套 CI)
  space\        (產品 repo，獨立部署)
  ai-island\    (產品 repo)
  pet\          (產品 repo)
  yukiboard\    (Kotlin 產品 repo)
  tammon\       (Python 產品 repo)
  insight\      (產品 repo)
  md2deck\      (產品 repo)
```

- **產品維持各自 repo**：多語言、各自部署節奏、各自 CI——這是它們該獨立的理由。
- **共用收進「一個」`snowrealm-platform` monorepo**：SDK（發到 npm private / GitHub Packages）+ HTTP 服務（各自部署）。
- 產品透過 `@snowrealm/*` 套件 + 打 Platform HTTP 消費，不靠目錄相鄰。
- **為何共用用 monorepo、產品用 polyrepo**：共用套件彼此依賴、常一起改，放一起才好做原子改動 + 一套 CI；
  產品彼此獨立、不同語言、不同上線節奏，硬綁一起只會互相拖累。
- **本機傘狀夾**（`D:\SnowRealm\`）純為整理，可有可無，跟架構無關。

### 遷移順序（絞殺式）

1. 開 `snowrealm-platform` monorepo（pnpm + turbo）。
2. **第一個抽 `@snowrealm/rich-editor`** 進去、發套件，讓 Space 反過來裝它 → 驗證「發/裝」這條路走得通。
3. 再把 Space 現成 package（`theme-engine`、`storage`、`validation`…已切乾淨）搬過去升 scope。
4. 之後才動 HTTP 服務（AI Router 先，種子 AI島/Space），配 `platform-js` / Python client。

> 每步「先抽一個、跨兩個產品驗證、再抽下一個」，不大爆炸重寫。

---

## 建議收斂順序（絞殺式，不大爆炸重寫）

1. **`@snowrealm/rich-editor`（B1）** — 零後端、風險最低、正要用。先抽這個練流程。
2. **`@snowrealm/theme`（B1/B2）** — `theme-engine` 已是 package，升 scope + 出 CSS。
3. **`@snowrealm/ui`（B1）** — 設計系統元件 + CSS。
4. **AI Router（A）** — 抽成 HTTP 服務（種子 AI島/Space），先跨兩個產品驗證，再配 `platform-js` / Python client。
5. **Economy：Z 幣 + AI Dot 帳本（A）** — 單一帳本，冪等；卡定價決策。
6. **SSO issuer（A）** — 唯一要拍板/新建的；其餘收斂完再收口。

> 原則：先抽一個能力、跨兩個產品驗證、再抽下一個。細部批次見 `SnowRealm-Platform-todo.md`。
