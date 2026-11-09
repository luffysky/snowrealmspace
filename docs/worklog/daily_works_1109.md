# 工作日誌 1109

> 部署遷移日：Zeabur 2026-12-31 停運（專用主機 12/3 到期），web 搬 Vercel、Supabase 搬 Vercel Marketplace（Free）、worker 改 Vercel Cron。經 tsc / next build / 預覽站 health 與 Cron 實測。

## 背景工作改由 Vercel Cron 觸發
- `apps/worker/src/jobs.ts`：`runScheduledJob()`（週期工作，handler 不看 job 內容）與 `drainQueues()`（取 pg-boss 佇列逐一執行）。
- 路由：`/api/cron/run/[job]`、`/api/cron/queue`（每分鐘，上限 800 秒，超過 5 分鐘不再開始新工作）。排程在 `apps/web/vercel.json`。
- 關鍵決定：web 端 `enqueue` 照舊用 pg-boss，佇列 job 最多延遲約 1 分鐘；排程不再用 pg-boss `schedule()`。`apps/worker/src/index.ts` 保留，本機仍可常駐。
- `boss.ts`：`startBoss` 改冪等（serverless 共用實例）、Vercel 上 `schedule: false`、`max: 2`。

## 資料庫與 Auth
- 新專案 `kgjljbmowlfeonihjape`（Vercel Marketplace Supabase Free，sin1，PG 17）。schema 跑 `supabase/migrations` 62 支，資料從舊庫 COPY（public 全部 + auth.users / auth.identities）。pgboss 歷史不搬。切換前最後同步：30,265 筆、0 筆差異，policies 70、functions 160、indexes 173、constraints 291 一致。
- Auth 用 `supabase config push` 設定（site_url、redirect、SMTP、Google、magic link 範本、email 驗證）。
- 踩雷：`[api] enabled = false` 推上去會關掉 Data API，PostgREST 回 PGRST002；症狀→health 的 database/queue query_failed；修法→config 帶回 `[api]` 區段。
- Google OAuth client 新增回呼 `https://kgjljbmowlfeonihjape.supabase.co/auth/v1/callback`，舊的先保留。

## 其他
- Next.js 15.5.21 → 15.5.29（安全修補）。
- Zeabur 舊 worker 已 suspend，避免新舊同時跑。

## 待你
- 實測 Email 與 Google 登入。
- 字體手動上傳（`/api/admin/fonts`）超過 4.5 MB 會被 Vercel 擋，尚未改成直傳 R2；Google 字體自動安裝不受影響。
- 輪替放過 Zeabur 的金鑰。
- Free 方案沒有自動備份，需另外安排定期備份。
- Zeabur 舊服務確認穩定後關閉。
