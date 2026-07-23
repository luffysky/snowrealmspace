# 事件系統、Queue 與背景任務

> 實作 ADR-007（pg-boss + Vercel Cron）與 ADR-013（一個事實來源，兩個投影）。
> v1.0 §36 / §37 列了事件名稱與 job 名稱，但沒有 payload schema、重試策略、冪等機制與投影規則。

---

## 1. 事件

### 1.1 型別

```ts
// packages/analytics/src/events.ts
export type DomainEventType =
  | 'space.opened' | 'space.created'
  | 'theme.created' | 'theme.updated' | 'theme.applied' | 'theme.deleted'
  | 'background.added' | 'background.changed' | 'playlist.started'
  | 'asset.uploaded' | 'asset.deleted'
  | 'design.linked' | 'design.synced' | 'design.analyzed' | 'design.compared'
  | 'project.created' | 'project.completed' | 'project.status_changed'
  | 'agent.message.sent' | 'agent.action.completed' | 'agent.action.undone'
  | 'memory.proposed' | 'memory.approved' | 'memory.rejected' | 'memory.deleted'
  | 'daily.item.opened' | 'surprise.unlocked'
  | 'insight.created' | 'milestone.reached'
  | 'widget.added' | 'widget.error' | 'layout.saved'
  | 'integration.connected' | 'integration.disconnected' | 'integration.error'
  | 'settings.changed'

export type DomainEvent<T extends DomainEventType = DomainEventType> = {
  id: string
  type: T
  spaceId: string
  actorId: string | null
  actorType: 'user' | 'agent' | 'system'
  entityType?: string
  entityId?: string
  properties: EventProperties[T]
  occurredAt: string
}
```

每個事件型別的 `properties` 都有具體型別，不是 `Record<string, unknown>`：

```ts
export type EventProperties = {
  'theme.applied':    { themeId: string; previousThemeId: string | null; source: 'user' | 'agent' | 'schedule' }
  'asset.uploaded':   { assetId: string; kind: string; bytes: number; deduplicated: boolean }
  'design.analyzed':  { snapshotId: string; depth: 'light' | 'deep'; model: string; isFree: boolean }
  'memory.approved':  { memoryId: string; type: string; sourceType: string }
  'surprise.unlocked':{ surpriseId: string; rarity: string; chainKey: string | null }
  'widget.error':     { definitionId: string; version: string; errorName: string }  // 不含使用者內容
  // ...
}
```

### 1.2 發出

```ts
// 一律在同一個 DB transaction 內寫入，確保「資料變更」與「事件」同生同死
export async function emit<T extends DomainEventType>(
  tx: Transaction,
  event: Omit<DomainEvent<T>, 'id' | 'occurredAt'>,
): Promise<void>
```

**禁止在 transaction 外發事件。** 否則會出現「事件說主題套用了但實際沒套用」或反之。

`space_settings.activity_tracking = false` 時：
- 仍寫入功能必需的事件（`theme.applied`、`memory.approved` 等會影響產品行為的）
- **不寫入**純分析用的事件（`space.opened`、`widget.error` 等）

### 1.3 投影到 Timeline（ADR-013）

```ts
// packages/analytics/src/timeline-projection.ts
const PROJECTED: Partial<Record<DomainEventType, ProjectionRule>> = {
  'project.created':   { title: e => `開始了「${e.properties.name}」`, icon: 'project' },
  'project.completed': { title: e => `完成了「${e.properties.name}」` },
  'asset.uploaded':    { title: e => `新增了作品`, coverAssetId: e => e.entityId,
                         throttle: { windowMinutes: 60, groupTitle: n => `新增了 ${n} 個作品` } },
  'design.synced':     { title: e => `同步了新版本` },
  'theme.created':     { title: e => `建立了主題「${e.properties.name}」` },
  'theme.applied':     { title: e => `套用了新主題`, throttle: { windowMinutes: 1440 } },
  'integration.connected': { title: e => `連接了 ${e.properties.provider}` },
  'memory.approved':   { title: () => `新增了一則記憶`, visibility: 'private' },
  'surprise.unlocked': { title: e => `解鎖了驚喜`, minRarity: 'rare' },
  'milestone.reached': { title: e => e.properties.label },
}
// 未列出的事件（space.opened、widget.error 等）不投影。
```

**節流（throttle）是必要的。** 一次上傳 20 張圖會產生 20 筆事件；沒有節流，Timeline 那天就只剩上傳記錄。同一時間窗內的同型別事件合併為一筆，標題改用 `groupTitle`。

投影由 `event.project` job 非同步執行，每 30 秒批次處理 `projected_at is null` 的事件。

### 1.4 其他 consumer

| Consumer | 消費方式 |
|---|---|
| Insight Engine | 週期性掃描，非即時 |
| Agent Proactive | 特定事件觸發（`design.synced`、`integration.error`） |
| Notification | 同上 |
| Analytics | 每日匯出 |
| Achievement | 事件觸發規則比對 |

---

## 2. Queue

### 2.1 pg-boss 設定

```ts
// apps/worker/src/boss.ts
const boss = new PgBoss({
  connectionString: env.DATABASE_URL,
  schema: 'pgboss',
  retryLimit: 3,
  retryDelay: 30,
  retryBackoff: true,
  expireInMinutes: 30,
  archiveCompletedAfterSeconds: 86_400 * 7,
  deleteAfterDays: 30,
  monitorStateIntervalSeconds: 30,
})
```

### 2.2 Job 清單

| Job | 併發 | 重試 | 逾時 | 冪等鍵 |
|---|---|---|---|---|
| `asset.process` | 4 | 3 | 5 分 | `assetId` |
| `asset.analyze_local` | 4 | 2 | 3 分 | `assetId` |
| `asset.purge` | 2 | 5 | 10 分 | `assetId` |
| `design.analyze` | 2 | 2 | 5 分 | `snapshotId:depth` |
| `design.compare` | 2 | 2 | 3 分 | `snapA:snapB` |
| `theme.from_mood` | 2 | 2 | 2 分 | `requestId` |
| `video.transcode` | 1 | 2 | 30 分 | `assetId:profile` |
| `figma.sync` | 2 | 5 | 10 分 | `fileId:versionId` |
| `canva.export_poll` | 2 | 10 | 15 分 | `exportJobId` |
| `provider.token_refresh` | 4 | 3 | 1 分 | `connectionId` |
| `daily.generate` | 4 | 3 | 3 分 | `spaceId:localDate` |
| `insight.generate` | 2 | 2 | 5 分 | `spaceId:type:period` |
| `weekly.recap` | 2 | 2 | 5 分 | `spaceId:isoWeek` |
| `event.project` | 2 | 3 | 2 分 | batch |
| `notification.dispatch` | 4 | 3 | 1 分 | `notificationId` |
| `space.purge` | 1 | 5 | 60 分 | `spaceId` |
| `storage.gc` | 1 | 2 | 30 分 | date |

### 2.3 冪等

**每個 job 的 handler 第一件事是檢查工作是否已完成。**

```ts
// 反例：靠 queue 保證只跑一次（做不到）
async function handleAssetProcess(job) {
  await generateThumbnail(job.data.assetId)   // ❌ 重試時會重複生成
}

// 正確：handler 自身冪等
async function handleAssetProcess(job) {
  const existing = await db.assetRenditions.findFirst({
    where: { assetId: job.data.assetId, role: 'thumbnail' },
  })
  if (existing) return { skipped: true }       // ✅ 已完成，直接返回
  await generateThumbnail(job.data.assetId)
}
```

理由：pg-boss 保證 at-least-once，不保證 exactly-once。worker 在寫入 DB 後、標記完成前崩潰，job 就會重跑。

### 2.4 失敗處理

```
嘗試 1 失敗 → 30s 後重試
嘗試 2 失敗 → 60s 後重試（backoff）
嘗試 3 失敗 → 120s 後重試
全部失敗 → job_records.status = 'failed'
           → 若 job 對使用者可見（如 design.analyze），發出 in-app 通知
           → 若為系統 job，寫 audit_log 並告警
```

**永不靜默失敗**（v1.0 §46）。使用者觸發的每個非同步操作都必須有明確的成功或失敗結果。

### 2.5 Worker 健康

`/api/cron/queue-health` 每 5 分：
- `status='running'` 且 `started_at` 超過該類型逾時 → 標記 `failed`
- `status='queued'` 且等待超過 15 分 → 告警（worker 可能掛了）
- 連續 3 次檢查都有 stuck job → 發送告警通知

---

## 3. Cron（ADR-007）

### 3.1 時區問題

「每天早上為使用者生成內容」在多時區下不是單一時刻。作法：**每小時執行，挑出當地時間剛好跨過門檻的 space。**

```sql
-- /api/cron/daily-generate 每小時執行
select id, timezone
from spaces
where deleted_at is null
  and extract(hour from (now() at time zone timezone)) = 4
  and not exists (
    select 1 from daily_items
    where space_id = spaces.id
      and local_date = (now() at time zone timezone)::date
  );
```

天然冪等：`daily_items` 的 `unique (space_id, local_date, kind)` 讓重跑不產生重複（ADR-015）。

### 3.2 排程表

| 端點 | Cron | 動作 |
|---|---|---|
| `/api/cron/daily-generate` | `0 * * * *` | 為當地 04:00 的 space 入列 `daily.generate` |
| `/api/cron/token-refresh` | `*/15 * * * *` | 為 60 分內到期的 connection 入列刷新 |
| `/api/cron/insight-weekly` | `0 * * * *` | 為當地週一 09:00 的 space 入列週報 |
| `/api/cron/storage-gc` | `0 3 * * *` | 清理孤兒 asset 與逾期 pending 上傳 |
| `/api/cron/queue-health` | `*/5 * * * *` | 檢查 stuck job |

### 3.3 認證

```ts
export function verifyCronRequest(req: Request): boolean {
  const header = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${env.CRON_SECRET}`
  if (header.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected))
}
```

長度先比對是必要的：`timingSafeEqual` 對不同長度的 buffer 會拋錯。

**Cron 端點只入列，不做工作。** 逾時上限 10 秒。

---

## 4. Storage GC

每日 03:00 UTC：

```
1. 逾期的 pending 上傳
   assets where status='pending' and created_at < now() - 24h
   → 刪除 R2 物件（若存在）→ 刪除資料列

2. 軟刪除滿 30 天的 asset
   assets where deleted_at < now() - 30d
   → 刪除所有 rendition 的 R2 物件 → 刪除原檔 → 刪除資料列

3. 孤兒 R2 物件（每週日執行，成本較高）
   列出 R2 bucket 中所有 key
   → 比對 assets.storage_key + asset_renditions.storage_key
   → 不在 DB 中且建立超過 48 小時的 → 刪除
   → 每次刪除數量上限 5000，超過則記錄並告警（可能有 bug）

4. 過期的 AI 快取
   delete from ai_response_cache where expires_at < now()

5. 過期的邀請
   delete from space_invites where expires_at < now() and accepted_at is null
```

第 3 項的「上限 5000 + 告警」是安全閥：如果某次程式錯誤導致 DB 記錄遺失，GC 會想刪掉所有檔案。上限讓損害可控且會被發現。

---

## 5. Provider Webhook（v1.0 §17.4）

```
POST /api/webhooks/figma
  1. 讀取原始 body（不解析）
  2. 驗證簽章（HMAC，constant-time 比較）→ 失敗回 401 並記錄
  3. 解析 event id
  4. INSERT INTO provider_webhooks ... ON CONFLICT (provider, external_event_id) DO NOTHING
     → 影響 0 列表示重複 → 回 200 並結束（冪等）
  5. 入列 figma.sync job
  6. 回 200（3 秒內，不等 job 完成）
```

**必須立即回 200。** Provider 通常有 5–10 秒逾時，超時會被判定失敗並重送，造成雪崩。

`figma.sync` 中的速率限制處理（v1.0 §17.5）：
- 每個 connection 最多 1 個併發同步
- 429 回應 → 依 `Retry-After` 延遲重試
- 連續 5 次失敗 → connection 轉 `error`，發通知給使用者
- 每次同步後更新 `last_synced_at`，UI 顯示「上次同步：N 分鐘前」

---

## 6. 驗收條件

```gherkin
Scenario: 事件與資料同生同死
  Given 套用主題的 transaction 在寫入事件後失敗
  Then spaces.active_theme_id 未變更
  And activity_events 無該筆事件

Scenario: Timeline 節流
  When 使用者在 10 分鐘內上傳 20 個作品
  Then timeline_events 只有 1 筆
  And 該筆標題為「新增了 20 個作品」

Scenario: Job 冪等
  Given asset.process 已完成並產生縮圖
  When 同一個 job 因重試再次執行
  Then 不產生第二張縮圖
  And job 回傳 skipped

Scenario: Cron 重跑不重複生成
  When /api/cron/daily-generate 在同一小時內執行兩次
  Then 每個 space 的 daily_items 該日該類型只有一筆

Scenario: Webhook 重複送達
  When Figma 送出相同 event id 兩次
  Then 只入列一個 sync job
  And 兩次都回 200

Scenario: Job 失敗有使用者可見的結果
  Given design.analyze 三次都失敗
  Then job_records.status 為 failed
  And 使用者收到 in-app 通知
  And 通知說明可以重試

Scenario: GC 不刪除仍被引用的檔案
  Given 某 asset 的 deleted_at 為 31 天前
  And 該 asset 仍被 design_snapshot 引用
  Then GC 不刪除該檔案
  And 記錄異常（軟刪除本不該發生在有引用的 asset 上）
```
