# S5 — provider mock（以錄製的真實回應建）

> Milestone F sync 切片 S5。**規格禁止手寫理想化的 provider mock**
> （見 `docs/spec/00-README.md` 執行指示 6、`docs/spec/10-acceptance.md` F）。
> 唯一合法的 mock 來源＝**首次真憑證＋真檔的端到端實跑**，把 provider 的真實 REST 回應「錄」下來。
> 因此在第一次實跑之前，`recorded/` 是空的，S5 的 replay 測試會**明確 skip**（不是假通過）。

## 這個機制怎麼運作

三個角色，全部掛在 provider-core 的 HTTP seam（`ProviderHttpGet`）上：

| 角色 | 位置 | 職責 |
|---|---|---|
| **seam** | `packages/provider-core/src/index.ts` `ProviderHttpGet` / `resolveDefaultHttpGet()` | adapter 不直接 `fetch`，改走可注入的 GET。正式＝打真 REST；S5＝重播錄製檔。 |
| **record** | `packages/provider-core/src/record.ts` | 實跑時把去敏後的真實回應寫成 `recorded/<provider>/<endpoint>.json`。 |
| **replay** | `packages/provider-core/src/replay.ts` | 測試時把 fixture 重播成 `ProviderHttpGet`，注入 `new FigmaAdapter(http)` / `new CanvaAdapter(http)`。 |

fixture 依「provider + 端點類型」收斂成**單一代表性檔案**（不以動態 id 逐檔展開），
這樣 replay 不需要知道真實 file id 也能重播（測試中 `container` / `externalId` 參數無關緊要）：

```
recorded/
  figma/   account.json  list.json  file.json
  canva/   account.json  profile.json  list.json  file.json
```

端點 → 檔名對應（`fixtureKeyForUrl`）：

| provider REST | 檔案 |
|---|---|
| `GET api.figma.com/v1/me` | `figma/account.json` |
| `GET api.figma.com/v1/projects/:id/files` | `figma/list.json` |
| `GET api.figma.com/v1/files/:key` | `figma/file.json` |
| `GET api.canva.com/rest/v1/users/me` | `canva/account.json` |
| `GET api.canva.com/rest/v1/users/me/profile` | `canva/profile.json` |
| `GET api.canva.com/rest/v1/designs` | `canva/list.json` |
| `GET api.canva.com/rest/v1/designs/:id` | `canva/file.json` |

## 首次實跑怎麼錄

錄製是 **env-gated、預設關閉**——只有設了 `DESIGN_SYNC_RECORD_DIR` 才會作動，
且**完全不改變同步行為**（打完真 REST 之後才多寫一個檔；寫檔失敗只 log、不影響同步）。

1. 依 `docs/todo/todo_list_0728.md` A 區「第一次端到端試」把 Canva/Figma 連好、選一個真檔。
2. 錄製時對執行同步的那個 process（web dev server 或 worker）設環境變數，指向這個資料夾：

   ```bash
   # 指向本 repo 的 recorded/ 目錄（請用你的絕對路徑）
   export DESIGN_SYNC_RECORD_DIR="$PWD/packages/design-sync/src/__fixtures__/recorded"
   ```

   - web 手動同步：在啟動 `pnpm --filter @snowrealm/web dev` 的那個終端設好再啟動。
   - worker 背景 job：在啟動 `pnpm --filter @snowrealm/worker dev` 的終端設好再啟動。

3. 到設定頁連接 → 用 picker 選檔 → 同步。adapter 每打一次 provider REST，就會把該端點的
   **去敏**回應覆寫進對應 fixture（同端點多次同步＝保留最後一次的代表性回應）。
4. 錄完把 env 拿掉，恢復正常執行。

## 去敏（record 已做，但提交前仍要人眼複查）

`record.ts` 的 `redactRecorded` 是**盡力而為**的第一道防線：

- 命中敏感 key（`access_token` / `refresh_token` / `client_secret` / `email` / `secret` …）→ 整個換成 `[REDACTED]`。
- email 字串 → `[REDACTED_EMAIL]`。
- 帶 query 的 URL（縮圖常夾簽章 token）→ 去掉 `?` 後整段。

**提交 fixture 前務必自己再看一遍**，確認沒有殘留 token、email、team 名稱或其他 PII——
自動去敏擋不掉的（例如藏在自訂欄位裡的機密）要手動處理或整段刪掉。位元組（縮圖檔本身）
不進 fixture（fixture 只存 JSON 中繼），符合 ADR-005「位元組只在 assets」。

## replay 測試怎麼消費

`packages/design-sync/src/s5-replay.test.ts`：

- fixtures 缺席（現況）→ `it.skip`，測試名帶明確原因（「等待首次真憑證實跑的錄製 fixtures」）。
- fixtures 到位 → 自動改跑：用 `replayHttpGet(recordedDir)` 注入真 adapter，
  驗證 `fetchAccount` / `listFiles` / `fetchFile` 的**正規化輸出形狀**吃得下真實回應。
- 找不到某端點 fixture 時 replay 會拋 `MissingRecordedFixtureError`（絕不靜默回假資料）；
  測試以 `hasRecordedFixture` 逐端點守衛，只驗證實際錄到的端點。

機制本身（去敏、URL→端點對應、record→replay 往返、seam 真的會寫檔）另有單元測試
`packages/provider-core/src/record.test.ts`，用**明顯合成**的臨時資料驗證——那不是 provider mock，
刻意與這裡的 `recorded/` 真實 fixture 分開。
