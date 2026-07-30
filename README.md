# SnowRealm Space

一個會隨長期使用而成長的私人數位空間，給喜歡創作與設計的人。

> 完整規格見 [`docs/spec/`](docs/spec/)。動手前先讀 [`CLAUDE.md`](CLAUDE.md) 與
> [`docs/spec/00-README.md`](docs/spec/00-README.md)。

---

## 這是什麼

- **背景與主題** — 上傳圖片／影片、從圖片一鍵生成配色主題、深淺色自動化、
  背景可加漸層（線性／放射／多點網狀）、霧面玻璃、非破壞性裁切、亮度/飽和度/**對比**微調、
  排程輪播幻燈片（每張停留＋**切換淡入淡出時長**可調）；
  主題工作室即時預覽（顏色／字體／質感）、一鍵「儲存並套用」、**版本歷史/還原**、**設為最愛**、刪除主題
- **內建動態場景** — 約 300 個 canvas 粒子場景，分 6 類（天氣／星空宇宙／自然／慶祝／簡約／城市夜景），
  背景商店分頁瀏覽、可疊加在任何背景上、密度可調，配合 reduced-motion 降級
- **Lottie 動畫背景** — 5 個自製向量動畫（CC0），lottie-web 懶載入、省流量/減動態時降級
- **裝飾品** — 81 個可愛小圖（Fluent Emoji，MIT）自由拖曳擺放在頁面角落，可調大小／旋轉／透明度＋漸層染色；
  檢視時不擋任何點擊，`?decorate=1` 進編輯（每 space 持久化、沒擺就不顯示）
- **媒體庫** — 資料夾分類、圖片/影片/PDF/**音訊**篩選、pg_trgm 檔名搜尋、**分頁載入更多**、版本比較、軟刪除 30 天寬限
- **字體系統** — 開源繁中／拉丁字體，unicode-range 分片、首屏預算控管、
  全字重（100–900）、標題／內文可各自選字重；後台一鍵自動安裝（子集化移 worker 串流處理）
- **可自訂版面** — 拖拉（跟手）式 widget 格線、多套版面 CRUD + 6 套範本（專注／創作／每日／極簡／總覽）、
  每種螢幕寬度各自記住排列、一鍵還原預設。**加入區塊清單依分類分組**；每個 widget 有 **⚙ 設定彈窗**、
  可**各自設背景**（從場景庫選、動不動開關 + 透明度滑桿）；編輯時點 widget 有**震動回饋**（可關）。
- **27+ 種 widget** — 專注計時／心情打卡／目標追蹤／創作連續／天氣；**時間日期**（電子＋指針時鐘、多花色、西元/星期/民國/農曆勾選）、
  **天氣＋時間合併**；個人類（**紀念日 D+N**／**倒數計時**／**相框**／每日情話）、實用類（**迷你月曆**／待辦清單／**世界時鐘**／習慣追蹤）、
  放鬆娛樂（**呼吸練習**／骰子決定器／幸運籤）。民國/農曆走瀏覽器 Intl、免函式庫。
- **天氣**（opt-in，預設關） — 天氣小工具顯示日/夜、氣溫、地區與 jochang Lottie 動畫（晴/雨/雪/雷/霧/颱風、日夜版；小圖示一律播放、不套背景那種減動態靜止）；
  Open-Meteo 免金鑰、只存城市名不記座標；同時讓每日內容**依天氣挑選**（雨天/晴天/冷/熱…）
- **每日內容** — 語錄、創作提示、**每日一問**、**微行動**、**季節·節氣**、驚喜盒、生日鏈、主動訊息、每週回顧（Daily Loop）；
  **依使用者近況挑內容**（讀活動事件推出「剛回來／連續創作／夜貓」等狀態、對應加權）、**依天氣挑內容**（開啟天氣時）；
  生日當天以**信封生日卡**（掀蓋動畫）呈現，自動送出
- **創作與作品** — 專案、作品與版本比較、建立後可**改標題／描述／標籤**、**AI 視覺分析**回饋（light/deep）、**可對話討論作品**（沿用 AI 長期記憶）且**留分析歷史**（記專案／來源軟體／版本）；
  **公開作品集頁**與**唯讀分享連結**（逐作品 private／unlisted／public，連結可設到期、可撤銷）
- **外部設計工具整合**（Milestone F） — 連接 **Figma／Canva**（OAuth，token 加密儲存；每家可綁**多個帳號**）、Adobe 骨架（待憑證）、
  明確選檔同步進媒體庫並建版本快照；worker 背景同步（去重／指數退避／429 依 Retry-After／失敗通知）、
  webhook 觸發同步、選檔 picker UI（剩真憑證端到端實測與 mock 錄製）
- **捕捉與筆記** — 隨手捕捉 inbox（之後沉澱成筆記、封存**可還原**）、筆記增刪改（可加標題、可歸到專案）、隨手記小工具（跨裝置同步、草稿自動存）
- **AI 夥伴** — 免費模型優先的多模型路由 + Agent 工具 + 記憶（AI Core，金鑰到後台設）；
  **多模態對話**（傳圖片／檔案／語音轉文字）、**SSE 逐字串流**回覆、對話串管理、**AI 深入回顧**（有根據的建議）；
  **記憶語意檢索**（pgvector，對話自動挑最相關的記憶；Memory Center 可語意搜尋）；
  語氣可選（溫暖／輕柔／專業／俏皮／極簡）；**可幫 AI 命名**（首次引導取名）、
  頭像＋名稱顯示在對話；**全站 2D 漂浮小幫手**（可拖曳，回應依情緒換表情）；
  需確認的 Agent 動作（套用主題／大量標籤）在對話裡直接**確認／拒絕／復原**
- **管理後台** — 站台管理員專用：使用者上線資訊（上線時間／時長／裝置／大致地區，只存 IP 雜湊不存原始 IP）、AI 金鑰（可**啟用/停用**、設**每月預算**，超支自動改走免費模型）／模型／候選鏈／用量／每日額度／回應快取、
  Agent 動作、內容池、Feature Flags（即時切換）、系統健康、稽核日誌
- **隱私與資料權** — 匯出、逐項刪除、刪除空間（7 天寬限可還原）／帳號、資料地圖
- **上手** — 互動教學（spotlight 導覽，可略過/重看）、使用說明、隱私政策/使用條款
- **PWA** — 可安裝、桌面捷徑（首頁／陪伴／今日／靈感）、**離線頁 + Service Worker**（導覽 network-first，不服務過期 chunk）

隱私是預設：所有分析、記憶、外部連接都預設關閉，由使用者主動開啟。

---

## 技術棧

| 層 | 選型 |
|---|---|
| 前端 | Next.js 15（App Router）、React 19、TypeScript（嚴格） |
| 後端 | Supabase（Postgres + Auth + Row Level Security） |
| 儲存 | Cloudflare R2（透過 `StorageAdapter` 抽象） |
| 背景工作 | pg-boss（長駐 worker，非 serverless） |
| 部署 | Zeabur（web + worker + Supabase），R2 在 Cloudflare |

monorepo 用 pnpm workspace + Turborepo。

---

## 專案結構

```
apps/
  web/        Next.js 應用
  worker/     pg-boss 背景工作（影像處理、排程、GC）
packages/
  shared-types/   共用型別、字體目錄、env schema
  validation/     zod schema（含內容池與 FORBIDDEN_PATTERNS）
  db/             Supabase client、佈建、身分綁定
  storage/        R2 StorageAdapter
  theme-engine/   配色、對比、字體分片、毛玻璃預算
  widget-engine/  格線佈局、widget 註冊、設定欄位
  rich-editor/    共用富文本 SDK（tiptap，供筆記／捕捉／Agent 複用）
  analytics/      activity_events / audit_logs
  provider-core/  設計工具 adapter（Figma／Canva capability、webhook 驗簽）
  design-sync/    F 整合的 token 層與同步核心（web／worker 共用單一來源）
  weather/        天氣抓取（Open-Meteo，web／daily-engine 共用；純對應在 validation）
content/        每日內容池（YAML，由 seed 匯入）
docs/spec/      可執行規格與 ADR
supabase/       migration 與 RLS 測試
```

---

## 本機開發

需求：Node 24 LTS、Docker Desktop、pnpm。

```bash
# pnpm 裝在使用者目錄，每個 shell 先設 PATH
export PATH="$HOME/.npm-global:$PATH"

pnpm install
pnpm exec supabase start                 # Postgres + Auth + Mailpit + Storage
pnpm db:migrate && pnpm db:seed
pnpm tsx scripts/ci-setup-bucket.ts

pnpm --filter @snowrealm/web dev          # http://localhost:3000
pnpm --filter @snowrealm/worker dev       # 另開終端
```

| 服務 | 位置 |
|---|---|
| App | http://localhost:3000 |
| Supabase Studio | http://127.0.0.1:54323 |
| Mailpit（看 magic link） | http://127.0.0.1:54324 |

字體需另外準備（單套 6–16 MB，不進 git）：

```bash
pnpm fonts:download    # 下載 12 套（台北黑體需人工）
pnpm fonts:build       # 子集化分片
pnpm fonts:upload      # 上傳 R2 並寫入 fonts 表
```

---

## 品質閘門

提交前跑：

```bash
pnpm lint && pnpm typecheck && pnpm test
pnpm check:deps        # 分層依賴規則
pnpm check:secrets     # 機密未洩漏到 client bundle
pnpm check:rls         # 每張表都有 RLS policy
pnpm test:rls          # 跨 space 隔離（需 supabase 執行中）
pnpm check:content     # 內容池 schema / 去重 / 安全過濾
pnpm test:coverage     # 覆蓋率門檻

# E2E（自 build 到 .next-e2e，跑在 :3100，與 dev server 隔離）
pnpm test:e2e            # chromium
pnpm test:e2e:mobile     # 改 UI 後必跑
pnpm test:a11y           # 無障礙（axe-core）
```

所有檢查腳本都經過**變異測試** —— 刻意植入違規確認會被抓到。
「一個永遠不會失敗的檢查比沒有檢查更糟」。

---

## 部署

見 [`docs/spec/14-deploy-zeabur.md`](docs/spec/14-deploy-zeabur.md)。
兩個容器（web / worker）的 Dockerfile build context 都是 **repo 根目錄**。

> ⚠️ `NEXT_PUBLIC_*` 會在 build 時 inline 進 client bundle，
> 必須同時是 Zeabur 的 **build-time** 與 runtime 變數，否則整站 500。

---

## 目前狀態

| Milestone | 狀態 |
|---|---|
| A — Foundation | ✅ 完成 |
| B — Visual Personalization | ✅ 約 98%（剩手動走查與一個字體檔） |
| C — Creative Core | ✅ 大致完成（Projects／作品版本／Library／Timeline／隱私刪除；剩本地分析擴充） |
| D — AI Core | ✅ 大致完成（路由／Agent／多模態／SSE 串流／記憶＋語意檢索／視覺分析／深入回顧／對話歷史摘要；剩金鑰額度調校） |
| E — Daily Loop | ✅ 完成（cron 掃時區、週報、主動訊息、生日卡、依近況給內容） |
| F — Integration | 🚧 程式面完成（**納入 Canva**）：連接 ✅、S1 選檔同步 ✅、S2 worker job ✅、S3 webhook 觸發 ✅、S4 選檔 picker＋真實 last-synced ✅；剩 S5 mock 錄製與 Figma/Canva 真憑證端到端實測（卡真實連線） |

完整盤點見 [`docs/spec/91-backlog.md`](docs/spec/91-backlog.md)。

> **平台方向**：SnowRealm Space 是未來 SnowRealm 平台（`snowrealm.pet`）底下的一個產品；
> 平台身份、經濟、AI Router 的整合規劃見 [`docs/platform.md`](docs/platform.md) 與
> [`docs/SnowRealm-Platform-Planning.md`](docs/SnowRealm-Platform-Planning.md)。

---

## 授權

程式碼：私有專案。
內建字體：各自的 SIL Open Font License 1.1（隨字體散布授權全文）。
