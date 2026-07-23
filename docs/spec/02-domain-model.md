# 領域模型

> 實作 ADR-005（統一資產模型）與 ADR-006（`space_id` 為唯一租戶鍵）。
> 本檔定義實體、關係與生命週期。SQL 見 `03-database.md`。

---

## 1. 為什麼要重畫

v1.0 §34.1 的表列有三個各自獨立、且都存 `thumbnail_url` 的實體：`assets`、`design_files`、`backgrounds`。

用一個真實情境就會壞掉：

> Nami 上傳一張 `poster.png`。她把它設為背景，同時把它加進「六月海報」專案當作品，然後用它生成一套主題。

依 v1.0 的模型，這張圖會在三張表各存一次（三份 `source_url`、三份 `thumbnail_url`、三次縮圖生成）。接著出現四個必然的 bug：

1. 她把背景那份刪掉 → 作品那份還在 → R2 檔案不知道該不該刪。
2. 她改了作品標題 → 背景那份的標題不變 → UI 顯示兩個名字。
3. 縮圖生成 job 跑三次 → 三倍成本。
4. 儲存配額算三倍 → 使用者看到「已用 75 MB」但實際只上傳了 25 MB。

這四個都不是實作 bug，是模型 bug，寫再仔細的程式碼也修不好。

---

## 2. 核心切分：內容 vs 用途

```
                       ┌──────────────┐
                       │    assets    │  ← 位元組的唯一真相。不可變。
                       │  (immutable) │
                       └──────┬───────┘
                              │ 1:N
                       ┌──────▼──────────┐
                       │ asset_renditions│  ← 衍生檔：preview / thumbnail / poster frame
                       └─────────────────┘
                              ▲
          ┌───────────────────┼───────────────────┐
          │ 引用               │ 引用               │ 引用
┌─────────┴────────┐ ┌────────┴────────┐ ┌────────┴─────────┐
│ design_snapshots │ │ background_items│ │  空間中其他引用   │
│  （作品的版本）    │ │  （當背景用）    │ │ (theme 封面等)   │
└─────────┬────────┘ └─────────────────┘ └──────────────────┘
          │ N:1
┌─────────▼────────┐
│   design_files   │  ← 創作單元。不存位元組。
└──────────────────┘
```

一句話：**`assets` 回答「這些位元組是什麼」，其他表回答「這些位元組被拿來做什麼」。**

---

## 3. 實體定義

### 3.1 `assets` — 位元組的唯一真相

**不可變（immutable）。** 上傳後 `storage_key`、`checksum`、`bytes`、`mime_type` 永不改變。要換檔案就是新增一筆 asset。

| 欄位 | 說明 |
|---|---|
| `id` | — |
| `space_id` | 租戶邊界 |
| `created_by` | 歸屬，非授權欄位 |
| `kind` | `image` / `video` / `pdf` / `audio` / `font` / `document` |
| `mime_type` | 實際偵測的 MIME，**不信任 client 宣稱值** |
| `bytes` | 用於配額計算 |
| `checksum` | SHA-256。同 space 內重複上傳直接複用既有 asset |
| `storage_key` | R2 物件鍵 |
| `width` / `height` / `duration_ms` | 由 worker 探測後回填 |
| `status` | `pending` → `ready` / `failed`（見 §5.1） |

**為什麼不可變：** 讓所有引用者不需要處理「我引用的東西內容變了」。design_snapshot 指向某個 asset，就永遠是那個畫面——這是「版本比較」功能能成立的前提。

**去重：** `unique (space_id, checksum)`。同一個 space 重複上傳同一個檔案時，回傳既有 asset 而非新建。跨 space 不去重（避免推斷出別人有哪些檔案）。

### 3.2 `asset_renditions` — 衍生檔

| `role` | 產生時機 | 說明 |
|---|---|---|
| `thumbnail` | 上傳後自動 | 400px 長邊，WebP |
| `preview` | 上傳後自動 | 1600px 長邊，WebP |
| `poster` | 影片上傳後自動 | 第一幀，供 reduced-motion 用（ADR-019） |
| `transcode_720` / `transcode_1080` | V1 | 影片轉碼 |

刪除 asset 時 renditions 一併 CASCADE，且 R2 上的物件由 GC job 清除。

### 3.3 `design_files` — 創作單元

代表「一個作品」這個概念，**不存位元組**。

- `provider`：`upload` / `figma` / `canva` / `adobe` / `other`
- `external_id`：Provider 端的 ID（`upload` 時為 null）
- `sync_status`：`manual` / `active` / `paused` / `error`
- `project_id`：可選，歸屬某專案

上傳的圖與 Figma 檔在這一層是**同一種東西**，差別只在 `provider` 與是否有 `external_id`。這是 v1.0 §20 Adapter 介面能成立的前提。

### 3.4 `design_snapshots` — 作品的某個版本

| 欄位 | 說明 |
|---|---|
| `design_file_id` | 所屬作品 |
| `asset_id` | 指向該版本的畫面（**這是關鍵連結**） |
| `external_version_id` | Provider 端版本 ID |
| `document_asset_id` | 可選，原始結構資料（Figma JSON）另存為一筆 asset |
| `extracted_features` | 本地分析結果（ADR-012） |
| `vision_features` | Vision 分析結果，含 confidence |
| `checksum` | 去重用：內容相同不建新 snapshot |

上傳作品時同時建立 `design_files` + 第一筆 `design_snapshots`。之後每次同步或重新上傳建立新 snapshot，舊的保留 → 版本比較功能自然成立。

### 3.5 `background_items` — 把某個 asset 當背景

**取代 v1.0 §34.5 的 `backgrounds` 表。** 這不是一個「背景檔案」，而是一組「呈現設定」。

```ts
export type BackgroundItem = {
  id: string
  spaceId: string
  assetId: string | null        // gradient / procedural 時為 null

  type: 'image' | 'video' | 'gradient' | 'procedural'

  fit: 'cover' | 'contain' | 'original'
  positionX: number             // 0–100，百分比
  positionY: number
  zoom: number                  // 1.0 = 原始

  blur: number                  // 0–40 px
  brightness: number            // 0.2–2.0
  contrast: number
  saturation: number

  overlayColor: string          // hex
  overlayOpacity: number        // 0–1

  loop: boolean                 // 僅 video
  muted: true                   // 僅 video，恆為 true（ADR-019）

  gradientSpec?: GradientSpec   // type = 'gradient' 時
  proceduralId?: string         // type = 'procedural' 時
}
```

`assetId` 為外鍵。**同一個 asset 可被多個 background_item 引用**——同一張圖可以有「白天版（亮）」與「夜晚版（暗+模糊）」兩組設定，共用同一份位元組。

### 3.6 `background_playlists` — 幻燈片

- `playlists`：名稱、播放模式、間隔、轉場、排程規則
- `playlist_items`：`playlist_id` + `background_item_id` + `position`

排程（v1.0 §12.7）存在 playlist 的 `schedule` JSONB，以 space 時區計算。

---

## 4. 完整實體關係

```
auth.users
    │ 1:N
    ▼
space_members ──N:1── spaces ──1:1── space_settings
                        │
    ┌───────────────────┼────────────────────────────────┐
    │                   │                                │
    ▼                   ▼                                ▼
  assets            projects                         themes
    │                   │                                │ 1:N
    ├─1:N─ asset_renditions                        theme_versions
    │                   │
    ├──────────┐        │
    ▼          ▼        ▼
background   design_files ──1:N── design_snapshots
  _items          │                     │
    │             └── design_connections│（provider 為外部時）
    │ N:M                               │
    ▼                                   ▼
background_playlist_items         design_insights
    │
    ▼
background_playlists

layouts ──1:N── widget_instances ──N:1── widget_definitions

agent_threads ──1:N── agent_messages
memories
activity_events ──投影──> timeline_events
daily_items
surprises ──1:N── surprise_unlocks
notifications
```

---

## 5. 生命週期

### 5.1 上傳

```
1. Client: POST /api/assets/upload-intent
             { filename, mimeType, bytes, checksum }
   ├─ 檢查配額（ADR-022）→ 超過回 413
   ├─ 檢查 checksum 是否已存在於本 space → 存在則直接回既有 asset，結束
   └─ 建立 assets(status='pending')，回 signed PUT URL（10 分鐘、單次）

2. Client: PUT → R2（直傳，不經過我們的伺服器）

3. Client: POST /api/assets/:id/complete
   ├─ 從 R2 讀取物件 metadata，驗證實際 bytes 與 checksum 相符
   ├─ 以檔案內容偵測真實 MIME（不信任 client）→ 不符則 status='failed'
   ├─ status='ready'
   └─ 入列 asset.process job

4. Worker: asset.process
   ├─ 探測 width / height / duration_ms → 回填
   ├─ 產生 thumbnail + preview rendition
   ├─ 影片額外產生 poster frame
   └─ 入列 asset.analyze_local job（本地取色與指標，ADR-012）

5. 前端在 3 完成後即可顯示（用原圖），renditions 就緒後自動換上
```

**24 小時後仍為 `pending` 的 asset 由 GC 清除**（ADR-022）。

### 5.2 上傳的圖成為作品

```
POST /api/design/files
  { assetId, title, projectId? }
    ├─ 建立 design_files(provider='upload')
    ├─ 建立 design_snapshots(asset_id = assetId)
    ├─ 發出 asset.linked_as_design 事件
    └─ 入列 design.analyze job（若使用者已同意 AI 分析）
```

### 5.3 作品成為背景

```
POST /api/backgrounds
  { assetId, ...呈現設定 }
    └─ 建立 background_items(asset_id = assetId)
```

**注意這裡沒有複製任何檔案。** 這正是模型正確的證明。

### 5.4 刪除

刪除是這個模型最需要小心的地方。

**刪除 background_item：** 只刪設定。asset 不動。

**刪除 design_file：** 刪除其所有 snapshot。**asset 不動**——它可能還被當背景用。

**刪除 asset：** 必須先檢查引用。

```
DELETE /api/assets/:id
  ├─ 查詢所有引用（design_snapshots / background_items / themes.cover / projects.cover）
  ├─ 有引用 → 回 409，附上引用清單（含名稱與連結）
  │            使用者可選「一併刪除引用」→ 帶 ?cascade=true 重試
  └─ 無引用 → 標記 deleted_at（軟刪除）
              入列 asset.purge job（30 天後真正從 R2 刪除）
```

**軟刪除 + 30 天寬限**的理由：v1.0 §5.1 要求使用者能撤銷。誤刪一張重要作品且立刻永久消失，是這個產品最不能發生的事——它宣稱自己是「會累積回憶的空間」。

**帳號刪除：** 一律硬刪除，不留寬限期（v1.0 §32.3）。順序為 R2 物件 → 資料列 → auth.users。詳見 `03-database.md`。

---

## 6. 授權模型

### 6.1 唯一邊界

**每一張承載使用者內容的表都有 `space_id`，且它是唯一的授權判準。**

```sql
space_id in (select space_id from space_members where user_id = auth.uid())
```

`created_by` 只用於顯示「誰做的」，**永不出現在 RLS policy 的 USING 子句**。

### 6.2 角色

| 角色 | v1.0 § | 權限 |
|---|---|---|
| `owner` | 41.1 | 全部。唯一能刪除 space、管理成員、連接 provider、匯出的角色 |
| `guest` | 41.2 | 只讀 `visibility = 'shareable'` 的內容。**永不可讀** memories、design_connections、ai_usage_log |
| `collaborator` | 41.3 | V2。在 `feature.collaboration` flag 之後 |

Birthday Alpha 只會存在 `owner`。但 policy 從第一天就依角色撰寫，避免日後回頭改寫每一條。

### 6.3 三張表永不對非 owner 開放

| 表 | 理由 |
|---|---|
| `design_connections` | 含加密 token |
| `memories` | v1.0 §41.2 明列 |
| `ai_provider_keys` / `ai_models` / `ai_usage_models` | 系統設定，僅 service role |

---

## 7. 與 v1.0 的差異對照

| v1.0 定義 | 本檔 | 原因 |
|---|---|---|
| `backgrounds`（獨立實體，存 url） | `background_items`（引用 asset） | ADR-005：位元組只存一份 |
| `asset_versions` | 移除 | asset 不可變；版本語意由 `design_snapshots` 承擔 |
| `design_files.owner_id` | `design_files.space_id` + `created_by` | ADR-006：統一租戶鍵 |
| `DesignSnapshot.previewUrl` | `design_snapshots.asset_id` | 不再直接存 URL |
| `BackgroundItem.sourceUrl` | `BackgroundItem.assetId` | 同上 |
| `memories.user_id`（同時有 space_id） | `space_id` 為授權鍵，`created_by` 為歸屬 | ADR-006 |
| 未定義 | `space_settings` 表 | v1.0 §31 的設定需要落點 |
| 未定義 | `agent_profile` 表 | v1.0 §57.3/57.4 延後的欄位需要預留 |
| 未定義 | `deleted_at` 軟刪除 | §5.4 的撤銷需求 |

---

## 8. 不變式

實作與 code review 時必須守住的規則：

1. 任何表新增時，若它承載使用者內容 → **必有** `space_id` 且**必有** RLS policy。
2. 位元組只存在 `assets` 與 `asset_renditions`。任何其他表出現 `*_url` 欄位指向使用者檔案 → 設計錯誤。
3. `assets` 的 `storage_key` / `checksum` / `bytes` / `mime_type` 在 `status='ready'` 後不得 UPDATE。
4. RLS policy 的 USING 子句不得出現 `created_by = auth.uid()`。
5. `activity_events` 只 INSERT，永不 UPDATE / DELETE（帳號刪除除外）。
6. 刪除 asset 前必須檢查引用。
