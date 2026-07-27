# 工作日誌 0728

> Milestone F 提前開工（connect + sync S1/S2）。工作法：子代理寫、主對話逐檔審 + 獨立重跑閘門後才 commit。全部 push。

## Milestone F — Integration（設計工具整合，提前開工）
> 決定：F 納入 Canva（覆寫 spec §F「不做 Canva／列 V2」，見 90-build-log ADR-001 偏離）。sync 切 S1–S5。

### 連接半段（`3dea7a1`）
- OAuth connect/callback（Figma+Canva）：owner 限定、flag 關→404（ADR-018）、state+PKCE 封 AES-256-GCM cookie、
  callback **再驗現在 session 使用者==發起人**（防 cookie 重放）、token 加密存 `design_connections`（getDb 受 RLS）。
- DELETE 中斷連線：`?purgeData` 明確選保留（標 paused/revoked）或刪派生，**不刪共享 asset**（ADR-005）。
- 使用者端 `settings/integrations` UI + 後台 Canva Token 轉換器（貼導回網址→換 token）。
- env 加 `CANVA_*`/`FIGMA_REDIRECT_URI`（全 optional，未設→停用不擺假按鈕）。

### S1 —— adapter + 選檔同步 + snapshot（`86bd8b9`）
- `DesignProviderAdapter` 加 `listFiles`/`fetchFile`（純 HTTP 層、非 2xx 拋 `ProviderApiError`）；
  Figma 無 project id 直接拋錯 → 結構上擋「列整個 Team」。
- `syncSelectedFiles`：抓檔 → upsert `design_files` → 預覽走 **StorageAdapter 進 assets**（checksum 去重、
  內容嗅探必須圖片）→ `createSnapshotFromAsset` 建版本。位元組只在 assets（ADR-005）。
- `[key]/files`（列檔）、`[key]/sync`（選檔、externalIds 必填非空、**無「全部」路徑**）。

### S2 —— worker sync job（`59116e5`）
- worker 不能 import apps/web → 抽 **`@snowrealm/design-sync` 套件**為單一來源；web 4 檔改 `export *` 薄 barrel（路徑不變）。
- `design.sync` handler：**單檔一 job**、`singletonKey` 去重、**handler 主導重試**（非 pg-boss 自動重試才能遵守 Retry-After）——
  429 依 Retry-After、暫時性指數退避（30s→30m）、4xx 永久不重試、連 5 次失敗轉 `error` + 通知（既有 `notifications`、`sync_failed`）。
- 退避/去重/永久判定抽純函式，**15 單元測試**。`POST /sync` 改入列（202）。worker service role 但每查詢帶 `space_id`（規則#10）。

### 主對話審查（逐檔 + 獨立重跑 lint/typecheck/check:secrets/check:deps/check:rls）
- 揪出並排除一個**誤判**：以為 `design_connections` 只 grant select 會擋寫入——查 0007 default privileges 給的是 all、無 revoke → 實際可寫，非 bug。
- 揪出**測試沒真跑到**：`pnpm --filter design-sync test` 因 CWD 找不到測試檔（No test files found）；改用 root vitest 指定路徑 → 15 測試真的過。
- 確認 `sync_failed` 是 0016 內建合法通知分類、notify 欄位與 web `createNotification` 一致。

## 部署驗證（Luffy 設 env）
- 對 6 張 Zeabur 截圖逐一比對：web + **worker 都**有 `CANVA_*`/`FIGMA_*`/`TOKEN_ENCRYPTION_SECRET`/R2/service role。
- 提醒 `TOKEN_ENCRYPTION_SECRET` 兩服務必須**同值**（web 加密、worker 解密）——Luffy 確認一致。
- 揪出 `SENTRY_DNS` 筆誤（程式讀 `SENTRY_DSN`）→ Luffy 已改。

## 內容（三池續補）
- 第 25、26 輪 +800（welcome/seasonal/micro）：micro 1955 / seasonal 1932 / welcome 1940，總 19553。
- 過 check:content + 手動抽讀 + 反向 + 撞號檢查。救回一個被 agent 覆寫的 window.zh-TW 舊檔、新內容改前綴 ma-light 另存。
- **子代理配額撞上限 200/200** → Luffy 將調高 `CLAUDE_CODE_MAX_SUBAGENTS_PER_SESSION` 重開續補。

## 文件
- 補記 0727 工作日誌（狀態偵測/假值稽核/內容衝量/字體移 worker）與 **0726 第三批漏記**（大頭貼/Secret/SSE/語意檢索…）。
- todo #13 F 進度清單（連接✅/S1✅/S2✅/S3-S5⬜）+ 新增 `todo_list_0728.md`（進行中規劃）。
- CLAUDE.md 補「工作日誌 / 待辦」章節（位置+格式）。

## 待你
- 後台開 flag `canvaConnect`/`figmaIntegration` → 第一次端到端試（設定頁連 Canva → 選檔 → 同步 → 看 `design_snapshots` 出版本）。
- 調高子代理配額重開 session，續補 micro/seasonal/welcome 到 4000。
- **F 仍差**：S3（webhook 觸發）、S4（選檔/版本比較 UI）、S5（錄真實回應 mock）、Figma 端點實測。
