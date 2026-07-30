# CLAUDE.md

給在這個 repo 工作的 AI 代理與工程師。
**動手前先讀這份，再讀 `docs/spec/00-README.md`。**

---

## 這是什麼專案

SnowRealm Space — 一個會隨長期使用而成長的私人數位空間。
初始版本是給 Nami 的生日禮物，但底層必須從第一天就是多使用者架構。

| 文件 | 角色 |
|---|---|
| `docs/SnowRealm-Space-Full-Spec-v1.0.md` | 產品憲章。回答「為什麼」與「要做什麼」 |
| `docs/spec/` | 可執行規格。回答「怎麼做」。**衝突時以這裡為準** |
| `docs/spec/01-decisions.md` | ADR，所有決策的真相來源 |
| `docs/spec/10-acceptance.md` | 每個 Milestone 的驗收條件 |
| `docs/spec/90-build-log.md` | 實作與規格的偏離紀錄 |
| `docs/todo/todo_list_0724.md` | 被外部資源卡住的待辦 |

---

## 環境（重要，會踩坑）

### 平台
Windows 11 + Git Bash + Docker Desktop。Node 24 LTS。

### pnpm 裝在使用者目錄
`corepack enable` 需要寫入 `C:\Program Files\nodejs`，一般權限會 EPERM。
pnpm 裝在 `~/.npm-global`，**每個 Bash 呼叫都要先設 PATH**：

```bash
export PATH="$HOME/.npm-global:$PATH"
```

忘記設就會看到 `pnpm: command not found`。

### 本機服務
```bash
pnpm exec supabase start                 # Postgres + Auth + Mailpit + Storage
pnpm db:migrate && pnpm db:seed
pnpm tsx scripts/ci-setup-bucket.ts
pnpm --filter @snowrealm/web dev         # :3000
pnpm --filter @snowrealm/worker dev      # 另開終端
```

| 服務 | 位置 |
|---|---|
| App | http://localhost:3000 |
| Supabase API | http://127.0.0.1:54321 |
| Postgres | postgresql://postgres:postgres@127.0.0.1:54322/postgres |
| Studio | http://127.0.0.1:54323 |
| **Mailpit（看 magic link）** | http://127.0.0.1:54324 |

---

## 踩過的坑（每一項都真的發生過）

### 1. 不要在 dev server 執行中跑 `pnpm build`

`next build` 會覆寫 dev server 的 `.next`，結果是 **CSS chunk 回 404**。

症狀極具誤導性：頁面還能開、內容都在、看起來「還行」，但 `document.styleSheets.length === 0`，整個設計系統沒有生效。這個狀態在專案裡存在了很久都沒被發現，直到 axe 報「按鈕只有 23px 高」「focus outline 是瀏覽器預設」才追出來。

E2E 已經隔離（自己 build 到 `.next-e2e`，跑在 :3100），不受影響。但手動操作時要注意。

**懷疑 CSS 沒載入時，一行驗證：**
```bash
curl -s http://localhost:3000/login | grep -oE '/_next/static/css/[^"]*' | head -1
# 拿到 URL 後 curl 它，內容應該有 sr-button
```

### 2. Windows 上 `pkill -f "next dev"` 不可靠

踩了兩次。以為殺掉了，其實還在監聽 3000，接著刪掉 `.next` → 舊行程開始噴 `ENOENT: app-paths-manifest.json`，而測試打到的正是那個半死的行程。

**正確做法：**
```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force }
```

看到 `EADDRINUSE` 就是這個問題——代表你以為的新 server 根本沒起來。

**E2E 的 :3100 也一樣。** Playwright 設 `reuseExistingServer: false`（刻意的：
沿用既有 server 就無法保證測到的是目前這份程式碼），所以 port 被佔住時它會直接失敗，
訊息只有一行 `already used` —— 在背景執行時極容易被忽略，看起來像「跑了但沒輸出」。
實際上我因此損失了三次背景執行。

`pnpm test:e2e` / `test:e2e:mobile` / `test:a11y` 都已自動先釋放 :3100。
手動釋放：`pnpm ports:free` 或 `pnpm ports:free 3100`。

### 3. 環境變數要兩份，這不是重複

| 檔案 | 內容 | 涵蓋 |
|---|---|---|
| `.env.local`（根） | 全部，含機密 | node runtime：route handler、server component、worker、scripts |
| `apps/web/.env.local` | **只有 `NEXT_PUBLIC_*`** | edge runtime：middleware |

原因：middleware 跑在 edge runtime，變數是 build 時 inline 的，而 Next **只從 app 目錄**讀 `.env`。根目錄那份由 `dotenv-cli` 在 Next 啟動前注入。

走過的三條錯路，不要重走：
1. 在 `next.config.mjs` 用 dotenv 載入根 env → render worker 是獨立 process，拿不到
2. 改用 `next.config` 的 `env` key → **會把機密 inline 進 client bundle**
3. 正解：`dotenv -e ../../.env.local -- next dev`

**`.env.local` 不要放 `NODE_ENV`。** dotenv-cli 會把它注入 `next build`，`NODE_ENV=development` 會讓 production build 產出壞掉的 `/404`，錯誤訊息卻是完全無關的 `<Html> should not be imported outside of pages/_document`。

### 4. Supabase 的 redirect URL 允許清單

`supabase/config.toml` 的 `additional_redirect_urls` 必須包含 callback URL。

沒設的話 Supabase **靜默退回 site_url，且從 PKCE 降級成 implicit flow**（回傳 URL fragment 而非 `?code=`），登入直接壞掉但沒有明顯錯誤訊息。

**hosted 專案同樣要設**：Dashboard → Authentication → URL Configuration。

本機另外把 `auth.rate_limit.email_sent` 調到 1000（預設 2 封/小時，跑一次驗證腳本就用完）。

### 5. 桌機 E2E 全綠不代表行動版可用

Milestone B 收尾時，chromium 專案 51 項全過，mobile 專案卻有 **14 項失敗**。

根因：`.sr-nav` 內的連結列是不換行的 flex row，把 header 撐到 462px，
超過 Pixel 7 的 412px 視窗 → **行動瀏覽器為了塞下而縮小整頁** →
所有點擊座標偏移，按鈕變成點不到。**每一頁都受影響。**

症狀極具誤導性：Playwright 說「某個 theme chip 攔截了 pointer events」，
但 `elementsFromPoint` 在同一座標回報的是按鈕本身。
兩者矛盾就是「頁面被縮放」的訊號。

**診斷方法** —— 量這三個值是否一致：
```js
document.documentElement.scrollWidth   // 462 ← 內容寬度
document.documentElement.clientWidth   // 412 ← 視窗寬度
window.innerWidth                      // 462 ← 被縮放後的值
```
不一致就是水平溢位。再逐一找 `getBoundingClientRect().right > clientWidth` 的元素。

**規則：改完 UI 一定要跑 `--project=mobile`，不能只跑 chromium。**

### 6. `db:reset` 會清掉 Supabase 的預設 GRANT

drop public schema 連帶清掉 GRANT 與 default privileges，之後 service role 讀寫任何表都 `permission denied`。
已寫成 `0007_grants.sql`，新表由 default privileges 自動涵蓋。

### 7. 資料庫型別不要手寫

supabase-js 的 `GenericTable` 要求每張表有 `Relationships`。缺了整個 `Database` 型別會退化成 `never`，錯誤訊息指不到真正原因。

```bash
pnpm exec supabase gen types typescript --local --schema public \
  > packages/shared-types/src/database.generated.ts
```

改完 migration 就重新產生。CI 有漂移檢查會擋。

副作用：`check` 約束的欄位會是 `string` 而非 union → 用 `toSpaceRole()` / `toSpacePrivacy()` narrowing，**未知值降級為最小權限而非拋錯**。

### 8. `git add A B <已被 rm 的路徑>` 會整批中止 → 靜默漏 commit

真的發生過：要提交 4 個檔案，`git add` 清單裡誤帶了一個**剛剛已被 `git rm` 的路徑**。
git 對那個 pathspec 報 `fatal: pathspec ... did not match any files` 並**整批中止**——
4 個檔案一個都沒進 staging。但那次 commit 仍然成立（因為 `git rm` 早已獨立把「刪檔」
staged 了），結果 **commit 只帶了刪檔、真正的實作全部沒進去**。

後果雙重且有欺騙性：
1. CI/build 紅（引用了被刪掉的模組），但**本機一路綠**。
2. 那個功能其實**從未上線**（DB 已改、程式沒部署），線上看到的是半套狀態。

為什麼本機測不出來：`pnpm lint/typecheck` 走 turbo，讀的是**工作目錄**（已改好），
**不是 git HEAD**。工作目錄永遠是對的 → 本機全綠；CI 一 checkout HEAD 就爆。
`reuseExistingServer`／turbo 快取這類「讀工作目錄」的工具都有同樣盲點。

**規則（往後一律照做）：**
- **不要**在一行 `git add` 裡混入可能不存在的路徑。刪檔用 `git rm` 獨立處理，
  或直接 `git add -A <dir>` / 一個一個加。
- **每次 commit 後**跑 `git status --short` 確認乾淨；有疑慮再 `git show --stat HEAD`
  對照「我以為改了的檔案」是否真的在這個 commit 裡。
- 驗證「HEAD 對不對」時，看的是 `git show HEAD:<file>`，不是工作目錄。
  本機閘門綠 ≠ 提交出去的內容綠。

### 9. 水平溢位別用猜的：先量；真因常在 grid/flex 的隱藏最小尺寸

真實經過：手機 header「登出被裁、整頁位移」，我**連改三次**才中——
1. 以為是品牌名沒截斷 → 包 span + `max-width:42vw`，沒用；
2. 以為是漂浮球 fixed 出界 → 修 clamp，有幫助但不是主因；
3. 才發現真因：`.sr-shell` 的 grid 欄是 `1fr`（＝`minmax(auto,1fr)`），`auto` 下限＝
   內容 min-content，而動作區 `flex-shrink:0` 不縮 → 整條 grid track 被撐得比視窗寬 →
   裡面的 flex 子項**根本沒被要求縮** → 品牌名不截斷、登出被推出視窗、被 `overflow:hidden`
   裁掉。修：grid 欄改 `minmax(0,1fr)`、容器加 `min-width:0`。

**為什麼會改三次 = 我在「不能量」時用猜的、一次只換一個最近的嫌疑犯。**
CLAUDE.md #5 早就寫了正解（量 `scrollWidth` vs `clientWidth`、找
`getBoundingClientRect().right > clientWidth` 的元素），但那需要瀏覽器，而當下 Chrome
擴充沒連上，我就退而用推理——推理只看到最靠近的元素，沒追到上游的 grid 軌道。

**規則（比這個 bug 本身更重要）：**
- **破版/溢位先想辦法量，不要連續送猜測修正上線**。自己開不了瀏覽器時：請使用者在
  DevTools Console 貼一段列出溢位元素的片段（或本機重現），拿到事實再改。
  讓使用者反覆截圖當白老鼠，是把「我不會量」的成本轉嫁給他。
- 真的只能推理時**從根往葉推**：先問「這個寬度是誰決定的」。容器
  （grid track / flex-basis / `min-width:auto`）往往才是真因，最靠近眼睛的元素
  （這裡的品牌名）通常只是症狀。
- `min-width:auto`（flex 子項預設）與 `minmax(auto,1fr)`（grid 欄預設）是水平溢位
  的頭號慣犯；子項「該縮卻不縮」時第一個查它們。

一句話總結貫穿 #1、#2、#8、#9：**這個專案裡「看起來像對的」最會騙人——凡是能量的就去量，不能量就從根因推，別停在最近的症狀。**

---

## 工作方式（這個專案的期待）

### 檢查腳本要做變異測試

**「通過」不代表「有效」。** 這個專案裡的檢查腳本都經過刻意破壞驗證：

- `test:rls` — 停用 `spaces` 的 RLS 後必須有測試失敗（實測 3 項）
- `check:secrets` — 植入引用 service role key 的 `'use client'` 檔案後必須報錯
- 型別漂移檢查 — 改動 generated 檔後必須被抓到

寫新的檢查時照做。**一個永遠不會失敗的檢查比沒有檢查更糟**，因為它會給人虛假的安全感。

真實案例：dependency-cruiser 一開始「通過」，但因為 `@/*` 別名沒解析，**14 個 import 全部沒被檢查到**。是去 dump 依賴圖才發現的。

### 不要留假東西

- 假按鈕（點了沒反應、或永遠 Coming Soon）
- 假資料（provider 資料、AI 分析）
- 假關閉（隱藏按鈕但端點還能存取 → flag 關閉時**路由與 API 都要回 404**）

Milestone A 的 Home 頁刻意是空的，就是這個原則——寧可誠實說「還沒做」，也不擺上不能用的卡片。

### 靜默失敗是 bug

健康檢查一開始把 storage 的錯誤吞掉，只回 `unreachable`。那等於沒有檢查——壞了但不知道為什麼。現在會 log 出原因。

背景 job、AI 呼叫、上傳同理：失敗必須有使用者看得到的結果。

### 回報要誠實

- 測試失敗就說失敗，附輸出
- 跳過的步驟要講
- 沒做完的不要說做完了

Milestone A 第一次收尾時我列了五項未完成（E2E、axe、check:deps、CI、覆蓋率），沒有當作已通過。後來補完那五項時，抓到上面第 1 與第 2 個嚴重問題——如果當初含糊帶過就不會發現。

---

## 不可違反的規則

1. **每張帶 `space_id` 的表都要有 RLS policy 與跨 space 拒絕測試。**
   `pnpm check:rls` 會擋。這是多租戶唯一的實質保證，其餘都是慣例。
2. **授權一律用 `space_id`**，不用 `created_by` / `owner_id`（ADR-006）。
   `created_by` 只是「誰做的」，不是授權欄位。
3. **位元組只存在 `assets` 與 `asset_renditions`**（ADR-005）。
   其他表出現指向使用者檔案的 URL 欄位＝設計錯誤。
4. **不直接 import AI 廠商 SDK**，走 `@snowrealm/ai-core` 的 `completeForUsage()`（ADR-023）。
   ESLint + dependency-cruiser 雙重擋。
5. **不直接用 S3 SDK**，走 `@snowrealm/storage` 的 `StorageAdapter`。
6. **component 不寫死顏色**，用 `--sr-*` token。唯一豁免是 `apps/web/lib/theme-defaults.ts`。
7. **AI 預設走免費模型**，只有 tool calling / 使用者主動要求深入 / 免費模型低信心才升級付費。
8. **Agent 沒有刪除、封存、中斷連線、對外分享、上傳第三方的工具。**
   這些能力根本不提供，而不是「要求確認」。
9. **嚴格 TypeScript，所有 API 輸入用 zod 驗證。**
10. **service role 只用於**：邀請驗證與 space 佈建、寫入 activity_events / audit_logs、worker、cron。
    處理一般使用者請求時用 `getDb()`（受 RLS 約束）。

---

## 指令

```bash
# 品質閘門（提交前跑）
pnpm lint && pnpm typecheck && pnpm test
pnpm check:deps        # 分層規則
pnpm check:secrets     # 機密未洩漏到 client
pnpm check:rls         # 每張表都有 policy
pnpm test:rls          # 跨 space 隔離（需 supabase 執行中）
pnpm test:coverage     # 覆蓋率門檻

# E2E（自行 build 到 .next-e2e 並跑在 :3100，與 dev server 隔離）
# 這三個都會先自動釋放 :3100
pnpm test:e2e            # chromium
pnpm test:e2e:mobile     # ← 改 UI 後必跑，不能只跑 chromium
pnpm test:a11y

pnpm ports:free          # 手動釋放 3000 / 3100

# 資料庫
pnpm db:migrate        # 冪等，可重複跑
pnpm db:reset          # drop public schema 後重跑全部
pnpm db:seed

# 工具
pnpm invite:create <email>              # 產生邀請連結
pnpm tsx scripts/verify-milestone-a.ts  # 閉環驗證（需 dev server on :3000）
pnpm tsx scripts/queue-ping.ts          # queue 往返（需 worker 執行中）
```

---

## 目前狀態

| Milestone | 狀態 |
|---|---|
| A — Foundation | ✅ 完成。閉環 24/24，全閘門綠 |
| B — Visual Personalization | ✅ 約 98%（背景/主題/場景 335+套件化/字體系統；剩手動走查與一個字體檔） |
| C — Creative Core | ✅ 大致完成（Projects／作品版本＋編輯／Library＋翻頁／Timeline／隱私刪除） |
| D — AI Core | ✅ 大致完成（路由／Agent＋審批 UI／多模態／SSE／記憶＋語意檢索／視覺分析／對話摘要／金鑰預算） |
| E — Daily Loop | ✅ 完成（cron 掃時區、週報、主動訊息、生日卡、依近況/天氣給內容） |
| F — Integration | 🚧 程式面完成（連接／S1–S4／webhook）；剩 S5 mock 錄製與 Figma/Canva 真憑證端到端實測（卡真實連線） |

依 ADR-001，未通過驗收不得開始下一個 Milestone。

**校正過的權威待辦狀態見 `docs/todo/todo_list_0731.md`**（對照實際程式，取代 91-backlog / 0728 的過時「未做」標記）。
**被外部資源卡住的項目見 `docs/todo/todo_list_0724.md`**（字體檔、Zeabur、R2、AI 金鑰、Figma/Canva 真憑證）。

### 內容池補量產線（多批馬拉松）
`content/**` 各池補到 10 年份量：子代理各批**直寫** scratch 檔（只回 done，省 token）→ `scratchpad/assemble_pool.py`（或 greetings 專用版）做**全池近似去重 + FORBIDDEN_PATTERNS + 長度/night 不催促過濾**→ `pnpm check:content`（近乎必過）→ commit → `pnpm seed:content` 灌 hosted（upsert 冪等）。**坑**：check 去重是全池（會撞別池）；id 續號要用各檔真實最大號或批次 infix（`-x1-`）免撞。

部署平台為 **Zeabur**（ADR-008）：web、worker、Supabase 同一平台，R2 仍用 Cloudflare。

---

## 工作日誌與待辦（每次收工都要更新）

### 工作日誌 → `docs/worklog/daily_works_MMDD.md`

**這是「今天做了什麼」的地方**，不是 `docs/spec/90-build-log.md`（那份只記與規格/ADR 的**偏離**）。

- 檔名 `daily_works_MMDD.md`（例 `daily_works_0728.md`）；同一天量太大可分 `_MMDDb`、`_MMDDc`。
- 格式：`# 工作日誌 MMDD` 標題 → 一行 `>` 引言（當天性質 + 「經哪些閘門」）→ 數個 `## 主題` 分區，條列。
  重點：**功能寫「做了什麼＋關鍵決定」、bug 寫「症狀→根因→修法」、附 commit hash**；最後放 `## 待你`（Luffy 要做的事）。
- **收工前一定要寫**。若中途 push 了很多次，收工時**對照 `git log --since=<今天>` 補齊**——
  真的發生過：日誌更新 commit 之後又寫了一批（0726 漏了約 30 個 commit：大頭貼/Secret/SSE/語意檢索…），
  隔天才靠 git log 補回。**日誌更新 commit「之後」的工作最容易漏，收工前務必回頭比對 git log。**

### 待辦 → `docs/todo/todo_list_MMDD.md`

- **`todo_list_0724.md`** 是主待辦（長期累積，`#13` 是 Milestone F 完整進度清單；完成的項目劃線 `~~...~~ ✅`）。
- 每天開新規劃時可另開 `todo_list_MMDD.md` 專記「當天起的進行中規劃」（如 `todo_list_0728.md`），
  歷史與外部憑證細節仍指回 0724。
- 外部/被卡住的項目（憑證、Zeabur、R2、AI 金鑰）集中在 0724。

### 三份文件的分工（別放錯）
| 文件 | 放什麼 |
|---|---|
| `docs/worklog/daily_works_MMDD.md` | 今天做了什麼（進度流水帳，附 commit） |
| `docs/todo/todo_list_*.md` | 還沒做 / 待你做 / 進行中規劃 |
| `docs/spec/90-build-log.md` | **只放**與 ADR/規格的偏離（為什麼跟當初決定不一樣） |
