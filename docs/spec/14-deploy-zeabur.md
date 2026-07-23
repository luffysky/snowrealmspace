# 部署到 Zeabur

> 實作 ADR-008。
> 這份是照著做就能上線的步驟，不是概念說明。

---

## 服務組成

```
Zeabur 專案
  ├ supabase   Zeabur 的 Supabase 模板（Postgres + Auth）
  ├ web        apps/web/Dockerfile      對外，:8080
  └ worker     apps/worker/Dockerfile   無對外 port，長駐

Cloudflare
  └ R2         private bucket（Zeabur 沒有等價的物件儲存）
```

**為什麼 R2 留在 Cloudflare：** 零 egress 費用。這個產品的背景圖片是高頻讀取，
egress 會是主要成本。`StorageAdapter` 已抽象化，日後要換也只是換一個實作。

---

## 步驟

### 1. Supabase

1. Zeabur → Add Service → Marketplace → **Supabase**
2. 部署完成後記下：
   - `POSTGRES_CONNECTION_STRING`（內網位址）
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Supabase API 的對外網址

> **用內網位址當 `DATABASE_URL`。** 同專案的服務走內部網路，
> 延遲更低，也不必把資料庫暴露到公網。

### 2. 套用 schema

本機對著 hosted 資料庫跑一次：

```bash
DATABASE_URL="<Zeabur 的 Postgres 連線字串>" pnpm db:migrate
DATABASE_URL="..." NEXT_PUBLIC_SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." pnpm db:seed
```

migration 是冪等的，可以重複執行。

> ⚠️ `db:seed` 一定要跑。`widget_definitions` 沒有資料時，
> 所有 widget 的建立都會因為外鍵而失敗，而錯誤訊息完全指不到真正原因。

### 3. Cloudflare R2

1. Cloudflare → R2 → Create bucket（**private**，不要開公開存取）
2. Manage R2 API Tokens → Create（權限：Object Read & Write）
3. CORS 設定 —— 上傳是瀏覽器直傳，沒有這個會被擋：

```json
[
  {
    "AllowedOrigins": ["https://<你的網域>"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["content-type", "content-length"],
    "ExposeHeaders": ["etag"],
    "MaxAgeSeconds": 3600
  }
]
```

### 4. web 服務

Add Service → Git → 選 repo → 設定：

| 項目 | 值 |
|---|---|
| Dockerfile 路徑 | `apps/web/Dockerfile` |
| Build context | **repo 根目錄**（不是 `apps/web`） |
| Port | `8080` |

**環境變數**（`NEXT_PUBLIC_*` 必須同時是 **build-time** 與 runtime，
因為它們會在 build 時被 inline 進 client bundle）：

```bash
NEXT_PUBLIC_APP_URL=https://<你的網域>
NEXT_PUBLIC_SUPABASE_URL=<Supabase 對外網址>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>

SUPABASE_SERVICE_ROLE_KEY=<service role key>
DATABASE_URL=<Postgres 內網連線字串>

R2_ACCOUNT_ID=<Cloudflare account id>
R2_ACCESS_KEY_ID=<R2 token id>
R2_SECRET_ACCESS_KEY=<R2 token secret>
R2_BUCKET=<bucket 名稱>
# R2_ENDPOINT 留空！設了就會指向本機的 S3 模擬服務而不是真正的 R2
R2_REGION=auto

AI_KEY_ENCRYPTION_SECRET=<openssl rand -base64 32>
TOKEN_ENCRYPTION_SECRET=<openssl rand -base64 32>
CRON_SECRET=<openssl rand -hex 32>
```

### 5. worker 服務

Add Service → Git → 同一個 repo → 設定：

| 項目 | 值 |
|---|---|
| Dockerfile 路徑 | `apps/worker/Dockerfile` |
| Build context | **repo 根目錄** |
| Port | 無（不對外） |

環境變數：與 web **相同**，但不需要 `NEXT_PUBLIC_*`。

> ⚠️ **worker 不可休眠。**
> 排程由 pg-boss 管理（ADR-008），worker 被停掉排程就不會執行。
> 若平台有 idle 休眠設定，這個服務必須關閉它。

### 6. Supabase Auth 的 URL 設定 —— **漏了登入會壞**

Supabase Dashboard → Authentication → URL Configuration：

- **Site URL**：`https://<你的網域>`
- **Redirect URLs**：`https://<你的網域>/**`

**沒設的症狀非常難查**：Supabase 會靜默退回 site_url，
並且從 PKCE 降級成 implicit flow（回傳 URL fragment 而非 `?code=`），
登入直接壞掉但沒有任何明顯錯誤訊息。這是本機實際踩過的坑。

同一頁把 email 速率限制調到合理值（本機預設是 2 封/小時）。

### 7. 建立第一個邀請

Alpha 是邀請制（ADR-003），沒有邀請進不去：

```bash
DATABASE_URL="..." NEXT_PUBLIC_SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." \
NEXT_PUBLIC_APP_URL="https://<你的網域>" \
  pnpm invite:create you@example.com
```

---

## 部署後檢查

```bash
curl https://<你的網域>/api/health
```

應該回：

```json
{"status":"ok","checks":[
  {"name":"database","ok":true},
  {"name":"storage","ok":true},
  {"name":"queue","ok":true}
]}
```

任何一項 `false` 的對應原因：

| 失敗項 | 通常是 |
|---|---|
| `database` | `DATABASE_URL` 或 `SUPABASE_SERVICE_ROLE_KEY` 錯 |
| `storage` | R2 憑證錯，或 `R2_ENDPOINT` 沒留空 |
| `queue` | migration 沒跑（`job_records` 不存在） |

worker 的日誌應該出現：

```
[worker] 排程 maintenance.queue-health — */5 * * * * (UTC)
[worker] 排程 maintenance.storage-gc — 0 3 * * * (UTC)
[worker] 就緒。監聽佇列：…
```

---

## 環境分離

`preview` 與 `production` 必須用**不同的** Supabase 專案與 R2 bucket。
共用會讓 PR 的測試資料寫進正式資料庫。

preview 環境**不要設 `ANTHROPIC_API_KEY`** —— 少了它，
AI 路由會自動全走免費層（ADR-023），PR 不會產生帳單。

---

## 已知待辦

| 項目 | 說明 |
|---|---|
| 映像檔大小 | 目前沒有用 Next 的 `output: 'standalone'`。首次部署以正確性優先，之後再最佳化 |
| worker 監控 | 目前只有日誌。`queue-health` 偵測到卡住的 job 只是 log，還沒有告警管道 |
| 自訂網域與憑證 | 依 Zeabur 的網域設定流程 |
