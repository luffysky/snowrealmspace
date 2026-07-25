# SnowRealm Space

一個會隨長期使用而成長的私人數位空間，給喜歡創作與設計的人。
初始版本是給 Nami 的生日禮物，但底層從第一天就是多使用者架構。

> 完整規格見 [`docs/spec/`](docs/spec/)。動手前先讀 [`CLAUDE.md`](CLAUDE.md) 與
> [`docs/spec/00-README.md`](docs/spec/00-README.md)。

---

## 這是什麼

- **背景與主題** — 上傳圖片／影片、從圖片一鍵生成配色主題、深淺色自動化、
  背景可加漸層（線性／放射／多點網狀）、霧面玻璃、非破壞性裁切、排程輪播幻燈片
- **內建動態場景** — 約 50 個 canvas 粒子場景（雪／雨／櫻花／星空／螢火蟲…），
  可疊加在任何背景上、密度可調，配合 reduced-motion 降級
- **Lottie 動畫背景** — 5 個自製向量動畫（CC0），lottie-web 懶載入、省流量/減動態時降級
- **媒體庫** — 資料夾分類、標籤篩選、pg_trgm 檔名搜尋、版本比較、軟刪除 30 天寬限
- **字體系統** — 開源繁中／拉丁字體，unicode-range 分片、首屏預算控管
- **可自訂版面** — 拖拉（跟手）式 widget 格線、多套版面 CRUD + 6 套範本（專注／創作／每日／極簡／總覽）、
  每種螢幕寬度各自記住排列、一鍵還原預設。widget 含專注計時／心情打卡／目標追蹤／創作連續等
- **每日內容** — 語錄、創作提示、驚喜盒、生日鏈、主動訊息、每週回顧（Daily Loop）；
  生日當天以**信封生日卡**（掀蓋動畫）呈現，自動送出
- **創作與作品** — 專案、作品與版本比較、**AI 視覺分析**回饋（light/deep）；
  **公開作品集頁**與**唯讀分享連結**（逐作品 private／unlisted／public，連結可設到期、可撤銷）
- **捕捉與筆記** — 隨手捕捉 inbox（之後沉澱成筆記）、筆記增刪改、隨手記小工具（跨裝置同步）
- **AI 夥伴** — 免費模型優先的多模型路由 + Agent 工具 + 記憶（AI Core，金鑰到後台設）；
  **多模態對話**（傳圖片／檔案／語音轉文字）、對話串管理、**AI 深入回顧**（有根據的建議）；
  語氣可選（溫暖／輕柔／專業／俏皮／極簡）
- **管理後台** — 站台管理員專用：AI 金鑰／模型／候選鏈／用量／每日額度／回應快取、
  Agent 動作、內容池、Feature Flags（即時切換）、系統健康、稽核日誌
- **隱私與資料權** — 匯出、逐項刪除、刪除空間（7 天寬限可還原）／帳號、資料地圖
- **上手** — 互動教學（spotlight 導覽，可略過/重看）、使用說明、隱私政策/使用條款
- **PWA** — 可安裝、離線圖示、manifest

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
  analytics/      activity_events / audit_logs
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
| D — AI Core | ✅ 大致完成（路由／Agent／多模態／記憶骨架／視覺分析／深入回顧；剩 SSE 串流、embedding 語意檢索） |
| E — Daily Loop | ✅ 完成（cron 掃時區、週報、主動訊息、生日卡） |
| F — Integration | 🚧 骨架（Figma adapter／webhook；OAuth 待憑證） |

完整盤點見 [`docs/spec/91-backlog.md`](docs/spec/91-backlog.md)。

> **平台方向**：SnowRealm Space 是未來 SnowRealm 平台（`snowrealm.pet`）底下的一個產品；
> 平台身份、經濟、AI Router 的整合規劃見 [`docs/platform.md`](docs/platform.md) 與
> [`docs/SnowRealm-Platform-Planning.md`](docs/SnowRealm-Platform-Planning.md)。

---

## 授權

程式碼：私有專案。
內建字體：各自的 SIL Open Font License 1.1（隨字體散布授權全文）。
