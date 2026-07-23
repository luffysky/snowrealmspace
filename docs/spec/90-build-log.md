# 建置紀錄 — 實作過程中與規格的偏離

> 規格是動手前寫的，實作必然會遇到規格沒預見的事。
> 這一份記錄「實際做出來的東西」與 `01-decisions.md` 的差異，以及原因。
> 每個 Milestone 結束時更新。

---

## Milestone A（已完成）

### 環境與版本

| 項目 | 規格 | 實際 | 原因 |
|---|---|---|---|
| Node | 22 LTS | **24.13.1** | 開發機上的現行 LTS。`engines` 放寬為 `>=22`，未鎖上限 |
| pnpm | corepack 啟用 | **裝在 `~/.npm-global`** | `corepack enable` 需要寫入 `C:\Program Files\nodejs`，一般使用者權限不足 |
| Supabase | hosted | **本機 stack（Docker）** | 開發與 RLS 測試用；hosted 專案在部署時才建立 |
| R2 | Cloudflare | **本機用 Supabase 的 S3 相容端點** | 見下方 `R2_ENDPOINT` |

### 新增的套件（規格 §53 未列）

| 套件 | 為什麼需要 |
|---|---|
| `packages/db` | `apps/web` 與 `apps/worker` 都需要 Supabase client 工廠與 space 佈建邏輯。放在任一 app 內會造成跨 app 相依 |

### Schema 與 migration

**migration 編號與 `03-database.md` §0 的規劃不同。** 規格的編號是按主題分（0004_assets、0005_themes…），但實際是按 Milestone 需要的順序建立：

```
0001_extensions.sql        擴充 + touch_updated_at
0002_spaces_and_members.sql 表結構（無 policy）
0003_rls_helpers.sql        helper 函式 + 啟用 RLS + policy
0004_events_audit.sql       activity_events + audit_logs
0005_flags_jobs.sql         feature_flags + job_records
0006_auth_hooks.sql         auth.users → profiles trigger
0007_grants.sql             GRANT 與 default privileges
```

`0002` 與 `0003` 必須分開：policy 依賴 `is_space_member()`，而該函式又查詢 `space_members`，所以表要先存在。

**新增 `0007_grants.sql`（規格未提）。** `db:reset` 會 drop public schema，連帶清掉 Supabase 預設的 GRANT 與 default privileges，導致 service role 讀寫任何表都是 `permission denied`。寫成 migration 讓本機 reset 與全新 hosted 專案走同一條路徑。

**新增欄位：** `space_settings.surprise_pity_counter`（`09-content-pool.md` §6.1 的保底機制需要落點，提早建立避免日後 ALTER）。

### 型別

**`database.generated.ts` 改為由 `supabase gen types` 產生，不再手寫。**

手寫版本一開始無法通過編譯：supabase-js 的 `GenericTable` 要求每張表都有 `Relationships` 欄位，缺了就整個 `Database` 型別退化成 `never`，錯誤訊息完全指不到真正的原因。

副作用：產生的型別把 `check` 約束的欄位標成 `string` 而非 union。因此新增 `toSpaceRole()` / `toSpacePrivacy()` narrowing 函式（`packages/shared-types/src/domain.ts`），**未知值降級為最小權限而非拋錯** —— DB 已有 check 約束，走到那裡代表 schema 與程式碼不同步，此時降級比中斷服務安全。

### 環境變數：兩份 .env（規格 §3 只寫了一份）

這是實作中最花時間的一段，走了三條錯路：

1. **在 `next.config.mjs` 用 dotenv 載入根目錄的 `.env.local`** → Next 的 render worker 是獨立 process，拿不到。
2. **改用 `next.config` 的 `env` key 傳遞** → 那會把值 inline 進 client bundle，**機密會直接洩漏給瀏覽器**。
3. **正解：`dotenv -e ../../.env.local -- next dev`** → 在 Next 啟動前就進 `process.env`，父行程與所有 worker 都繼承。

但 middleware 跑在 **edge runtime**，其環境變數是 build 時 inline 的，且 Next 只從 **app 目錄** 的 `.env` 檔案讀取。因此最終結構是：

| 檔案 | 內容 | 涵蓋 |
|---|---|---|
| `.env.local`（根） | 全部，含機密 | node runtime：route handler、server component、worker、scripts |
| `apps/web/.env.local` | **只有 `NEXT_PUBLIC_*`** | edge runtime：middleware |

`apps/web/.env.local` 只放公開值，機密絕不放。兩份都有對應的 `.env.example`。

**另一個坑：** 根 `.env.local` 原本有 `NODE_ENV=development`。加上 dotenv-cli 之後，`next build` 也被注入這個值，導致 production build 產出壞掉的 `/404`，錯誤訊息是誤導性的 `<Html> should not be imported outside of pages/_document`。已移除 `NODE_ENV`，改由各指令自行決定。

### 新增 `R2_ENDPOINT` / `R2_REGION` / `R2_FORCE_PATH_STYLE`

規格把 R2 端點寫死為 `https://{accountId}.r2.cloudflarestorage.com`。加上可覆寫的端點，讓本機開發能指向 S3 相容的本地服務 —— 否則新開發者為了跑起專案必須先申請 Cloudflare 帳號，違背 `11-engineering-setup.md` §12 的上手目標。production 留空即自動使用真正的 R2。

### Supabase 本機設定的兩處修改

| 設定 | 原值 | 改為 | 原因 |
|---|---|---|---|
| `auth.site_url` | `http://127.0.0.1:3000` | `http://localhost:3000` | 與 `NEXT_PUBLIC_APP_URL` 一致，否則 magic link 導回錯誤主機 |
| `auth.additional_redirect_urls` | `["https://127.0.0.1:3000"]` | 含 `http://localhost:3000/**` | callback URL 不在允許清單時，Supabase 會靜默退回 site_url，且改用 implicit flow 回傳 fragment 而非 PKCE code |
| `auth.rate_limit.email_sent` | `2`（每小時，全專案） | `1000` | 僅本機。跑一次驗證腳本就會用完 2 封額度 |

**前兩項在 hosted 專案也必須設定**（Dashboard → Authentication → URL Configuration），否則登入會壞。

### 收尾補齊（Milestone A 第二階段）

先前列為「未完成」的五項已全部補上：

| 項目 | 結果 |
|---|---|
| Playwright E2E | `e2e/auth.spec.ts` 9 項，桌機與行動裝置各跑一輪 |
| axe-core 無障礙 | `e2e/a11y.spec.ts` 10 項，0 個 critical / serious violation |
| `check:deps` 分層檢查 | dependency-cruiser，7 條規則，46 modules / 64 deps |
| CI workflow | `.github/workflows/ci.yml`，5 個 job |
| 覆蓋率門檻 | `vitest.config.ts`，目前 100%（statements / branches / functions / lines） |

### 補齊過程中發現的問題

**1. 分層檢查一開始是假的。**
dependency-cruiser 用 `tsconfig.base.json` 解析，而該檔沒有 `@/*` 路徑對應，導致 `apps/web` 內 **14 個 import 全部無法解析** —— 檢查「通過」但其實一條規則都沒作用到 apps/web。修法是新增 `tsconfig.depcruise.json` 專門提供 paths。
（`enhancedResolveOptions.alias` 不是合法設定鍵，會被 schema 驗證擋下。）

**2. `globals.css` 曾經完全沒有載入。**
axe 的第一輪結果是按鈕 96×23px（不符 target size）、focus outline 是瀏覽器預設的 `auto`、`--sr-motion-intensity` 讀出空字串。三個症狀同一個原因：CSS chunk 回 404，`document.styleSheets.length === 0`。

**整個設計系統從頭到尾沒有生效過，而頁面看起來「還行」，所以一直沒被發現。**
根因是 dev server 執行中被 `next build` 覆寫了 `.next`。production build 本身是正確的。

**3. 由 2 衍生的隔離措施。**
`next.config.mjs` 加入 `distDir: process.env.NEXT_DIST_DIR || '.next'`；Playwright 改為自行 build 並在 **:3100** 啟動 production server（`.next-e2e`），`reuseExistingServer: false`。

好處有三：與 dev server 完全隔離、測到的是使用者實際拿到的產物、避開 Next dev overlay 注入的 `role="alert"`（那曾讓三個測試因 strict mode 撞名而失敗）。
代價是 `supabase/config.toml` 的 `additional_redirect_urls` 要加入 `http://localhost:3100/**`。

**4. Windows 上 `pkill -f "next dev"` 不可靠。**
兩次踩到同一個坑：以為殺掉了 dev server，實際還在監聽 3000，接著刪掉 `.next` → 舊行程開始噴 `ENOENT: app-paths-manifest.json`，而測試打到的是那個半死的行程。

**正確做法（Windows）：**
```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force }
```

**開發時的規則：不要在 dev server 執行中跑 `pnpm build`。** E2E 已經隔離，不受影響。

### 仍未做的

| 項目 | 說明 |
|---|---|
| CI 尚未實際跑過 | workflow 已寫好，但這個 repo 還沒有 git remote。首次 push 時需要驗證，尤其 `supabase start` 在 GitHub runner 上的耗時 |
| Visual regression | `11-engineering-setup.md` §7 列了，但 Milestone A 沒有值得比對的視覺內容。Milestone B（Theme）才有意義 |
| lefthook git hooks | 未安裝（尚未 git init） |

### 驗證方式

```bash
pnpm exec supabase start      # 本機 stack
pnpm db:migrate && pnpm db:seed
pnpm --filter @snowrealm/worker dev    # 另開終端
pnpm --filter @snowrealm/web dev       # 另開終端

pnpm tsx scripts/verify-milestone-a.ts # 24/24 閉環驗證
pnpm tsx scripts/queue-ping.ts         # queue 往返
```

品質閘門：
```bash
pnpm lint && pnpm typecheck && pnpm test
pnpm check:rls && pnpm check:secrets && pnpm test:rls
pnpm build
```

### 兩個檢查腳本經過變異測試

「通過」本身不代表檢查有效。兩者都以刻意破壞驗證過會失敗：

- **`test:rls`** — 對 `spaces` 與 `audit_logs` 執行 `disable row level security` 後，21 項中有 3 項失敗（正是跨 space 讀取的那三項）。復原後回到全綠。
- **`check:secrets`** — 植入一個引用 `SUPABASE_SERVICE_ROLE_KEY` 的 `'use client'` 檔案後正確報錯。移除後通過。


---

## Milestone B（進行中）

### 完成的部分

| 區塊 | 狀態 |
|---|---|
| Asset 上傳（三段流程 + worker 處理） | ✅ |
| Theme Studio + 對比檢查 + 匯出匯入 | ✅ |
| Background Studio + 幻燈片 | ✅ |
| Widget 拖曳 + 鍵盤操作 | ✅ |
| Font System | ⬜ 卡在字體檔 |

完整剩餘盤點見 `91-backlog.md`。

### 這一段抓到的 bug

**1. 匯出主題時 HTTP 500（中文檔名）**
HTTP header 只能是 latin-1，主題名稱幾乎都含中文：
`TypeError: Cannot convert argument to a ByteString`。
原本的「安全檔名」正則 `/[^\p{L}\p{N}_-]+/gu` 保留 Unicode 字母，中文正好通過。
改用 RFC 5987 雙軌：ASCII fallback + `filename*=UTF-8''<百分號編碼>`。
**只有真的用中文名字跑一次才會發現** —— schema 驗證與型別檢查都抓不到。

**2. `widget_definitions` 從沒 seed 過**
註冊表在 TypeScript，資料庫是空的。`widget_instances` 對它有 FK（on delete restrict），
所以所有 widget 建立都失敗，而錯誤訊息只是外鍵違反，完全指不到真因。
已加進 `scripts/seed.ts`，以註冊表為唯一真相同步進資料庫。

**3. 在 `setState` updater 裡呼叫 `onCommit`**
React 可能重複執行 updater（concurrent 渲染），導致交換被套用兩次而回到原位。
症狀是「按方向鍵完全沒反應」。副作用不可放在 state updater ——
改用 ref 保存目前佈局，在 handler 內做副作用。

**4. 用「交換座標」做重新排序會產生重疊**
寬 4 的 widget 換到 x=4 會壓到 x=7 的鄰居，驗證失敗 → 按鍵沒反應。
座標交換是錯的模型，改成 `reflow()`（像文字換行重新排版）+ `reorderByOne()`。
補了 16 個測試。

**5. 行動版整頁被瀏覽器縮小（影響每一頁）**
`.sr-nav` 內的 `<nav>` 是不換行的 flex row，五個連結把 header 撐到 462px，
超過 Pixel 7 的 412px 視窗 → 行動瀏覽器為了塞下而**縮小整頁** →
所有點擊座標偏移，按鈕點不到。

症狀極具誤導性：Playwright 報「某個 theme chip 攔截了 pointer events」，
但 `elementsFromPoint` 在同一座標回報的是按鈕本身。兩者矛盾的原因就是頁面被縮放。

找到真因的方法是量 `window.innerWidth`（462）與 `clientWidth`（412）不一致。
已加上 `flex-wrap`、窄螢幕的 header 堆疊，以及 `html, body { overflow-x: hidden }` 當最後防線。

**教訓：桌機 E2E 全綠不代表行動版可用。** 這個 bug 讓 14 個 mobile 測試失敗，
而 chromium 專案 51 項全過。

### 新增的可測純函式

`reflow` / `reorderByOne`（widget-engine）、`localHour` / `localDate` / `slotForHour` /
`seededIndex`（validation）。時區排程原本寫在 `apps/web/lib`，
移進 package 是因為它是領域邏輯，且**時區錯誤在正式環境幾乎不可能被使用者清楚回報**。

### 部署平台改為 Zeabur

ADR-008 更新。連帶影響：Cron 改用 pg-boss 的 `schedule()`（在 worker 內定義），
CI workflow 需改寫（目前假設 Vercel）。R2 保留 Cloudflare。

### 第三方登入綁定（提前實作）

原規劃列在 V1（`13-third-party-auth.md` §11），使用者要求提前。
提前的成本比想像低：**綁定**不需要面對註冊閘門的問題。
§4 那個「Google 登入直接建立 auth.users、繞過邀請檢查、產生孤兒使用者」
的陷阱，在綁定情境下不存在 —— 使用者早就通過邀請閘門並擁有 space 了。

新增 `0013_user_identities.sql`（`user_identities` + `oauth_transactions`）。

**三個與規格不同的決定：**

1. **LINE 的 session 用 admin `generateLink` + `verifyOtp` 產生。**
   §2.1 原本寫 `signInWithIdToken({provider:'oidc'})`，但 supabase-js
   沒有通用 oidc provider，LINE 也不在支援清單裡。

2. **state/nonce 存資料庫而非 cookie。** cookie 由使用者持有、可被竄改，
   而且無法保證「只能用一次」。`consumeTransaction` 用條件式 update
   （`.is('consumed_at', null)`）讓資料庫負責原子性 ——
   併發的第二個請求會 update 到 0 列。

3. **不做自動帳號合併。** §5 規劃「provider email 已驗證就自動合併」。
   實作時改成只支援手動綁定：自動合併的全部風險都在
   「provider 的 email 到底驗證了沒」這個判斷上，而手動綁定
   根本不需要回答那個問題 —— 使用者本人已經登入了。

**check:rls 需要新的例外類別。**
`user_identities` 的隔離鍵是 `user_id` 不是 `space_id`（登入方式屬於人，
一個人可以在多個 space）；`oauth_transactions` 則是刻意「開了 RLS 但零 policy」
＝ 只有 service role 能碰。後者原本會被檢查腳本判定為錯誤 ——
那個判定是對的，絕大多數情況下「開 RLS 沒 policy」就是寫錯。
加了 `SERVICE_ROLE_ONLY` 具名清單，並補上**反向檢查**：
列在清單裡卻有 policy 也會失敗。mutation test 確認兩個方向都會紅。

### CI：e2e job 從來沒有啟動 worker

`theme.spec.ts` 兩個測試在 CI 失敗、本機全綠。原因是本機開發時
worker 一直在另一個終端跑著，CI 沒有那個「順便」。
沒有 worker → `asset.process` 不執行 → 沒有色票 →
`/api/themes/from-image` 一直回 retryable → 測試逾時。

**教訓（與 mobile 那次同型）：本機綠燈可能靠的是環境裡的隱性狀態。**
凡是本機需要「另開一個終端」的東西，CI 都要明寫。

順帶把 `worker` job 併進 `database` job —— 兩者都要 `supabase start`
（runner 上 2–4 分鐘），而 queue 往返本身只要幾秒。

### 已知 bug：append-only rule 與「刪除使用者」衝突

部署到 hosted 後從 auth log 發現：刪除有活動紀錄的使用者會失敗，
`activity_events_actor_id_fkey ... gave unexpected result (SQLSTATE XX000)`。

根因不是 FK（`actor_id` 是 `on delete set null`，正確），而是
`activity_events` 的 **append-only RULE** 讓 update 變 no-op ——
刪使用者時 FK 要把 actor_id 設 null（一個 update），被 rule 擋掉。

影響：Milestone C/隱私的「刪除帳號」「刪除 space」會踩到。
修法（待實作時決定）：讓 rule 放行 FK 觸發的 SET NULL（用 `WHERE` 條件
排除系統觸發的 update），或改成刪除前先以 service role 匿名化 actor。
**不是現在的阻塞**，先記錄。

### 部署踩到的坑：測試 env 指向 hosted 會污染正式資料

.env.local 指向 hosted 時跑 test:rls / E2E，會把 @rls-test.local /
@e2e.local 的假使用者建到正式 Supabase。已寫 cleanup-test-users.ts 清理。
教訓：跑測試前務必確認 .env.local 指向本機，或用獨立的測試專案。
