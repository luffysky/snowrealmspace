# todo_list_0728 — 進行中規劃（新）

> 這份專記「還在做 / 接下來做」的規劃，2026-07-28 起。
> 已完成的歷史與外部憑證細節仍見 `todo_list_0724.md`（#13 是 F 的完整進度清單）。

---

## A. Milestone F — Integration（sync 半段，切片進行）

> 決定：F 納入 Canva（覆寫 spec §F「不做 Canva」，見 `90-build-log.md`）。
> 工作法：子代理寫一塊、主對話逐檔審 + 獨立重跑閘門後才 commit。

### 已完成（今天）
- [x] **連接半段**：OAuth connect/callback（Figma+Canva）、token AES-256-GCM 存 `design_connections`、
      設定頁連接/中斷 UI、後台 Token 轉換器。commit `3dea7a1`。
- [x] **S1**：adapter 列檔/抓檔、選檔同步（禁整 Team）、建 `design_snapshots`、rendition 走 StorageAdapter 進 assets。commit `86bd8b9`。
- [x] **S2**：抽 `@snowrealm/design-sync` 套件；`design.sync` worker job（單檔一 job、singletonKey 去重、
      handler 主導退避、429 依 Retry-After、連 5 次失敗轉 error+通知）；`POST /sync` 改入列 202。15 retry 測試。

### 待做
- [ ] **S3 — webhook 觸發同步**：`/api/webhooks/[provider]` 接上 canva（目前只掛 figma）；provider 事件 → 入列 `design.sync`。
- [ ] **S4 — UI**：選檔 picker（列 `/files` + 勾選送 `/sync`）；「上次同步時間」接真實 `last_synced_at`；版本比較 UI（compare API 已存在）。
- [ ] **S5 — mock**：以**錄製的真實回應**建 provider mock（規格禁手寫理想化 mock）。**卡真憑證+真檔**才錄得到。
- [ ] **🔴 Figma 端點/scope 實測校正**：provider-core 內 `TODO(figma)` 全部待對最新 Figma 文件實測（2024 改版後 token/scope 有變）。Canva 那側也尚未對真帳號實跑。

### 前置（Luffy 已備 / 待驗）
- [x] Zeabur web + **worker** 皆設 `CANVA_*`/`FIGMA_*`/`TOKEN_ENCRYPTION_SECRET`（兩服務 TOKEN 同值已確認）。
- [x] Canva 後台 redirect 設 `…/api/integrations/canva/callback`（app 保持開發狀態、不用送審）。
- [ ] 後台開 flag `canvaConnect` / `figmaIntegration`（預設關 → 端點 404）。
- [ ] **第一次端到端試**：開 flag → 設定頁連 Canva → 選檔 → 同步 → 看 `design_snapshots` 出現版本。

---

## B. 內容補量到 4000（#50，長期）

> 已達標：quotes 4045 / prompts 4001 / questions 4000 / greetings 1000。
- [ ] **micro_action / seasonal / welcome 三池補到各 4000**（截至今天約 1955 / 1932 / 1940）。
      多-agent 產線（見記憶 `content-4000-marathon`），每輪 check:content + 手動抽讀 + 反向 + 撞號檢查。
      **需調高 `CLAUDE_CODE_MAX_SUBAGENTS_PER_SESSION`（建議 1000）重開 session 續跑產線。**

---

## C. 天氣（#49 / #56，規劃完成、未動工）

- [ ] **#56 頁面天氣動畫區塊**：可 opt-in（預設關）、白天太陽/夜晚月亮、背景透明、顯示地區+氣溫、
      Lottie 或 WebGL；颱風畫大風大雨。GPS 需使用者授權（隱私 opt-in）。
- [ ] **#49 天氣感知內容**：接氣象 API + 位置，seasonal 已按天氣 tag（rainy/sunny/cold/hot…）備好內容可對接。

---

## D. 其他既有待辦（延續 0724）

- [ ] **#55** 內建背景擴充 + 套件化下載（動態/靜態/Lottie，分類、下載後套用、未下載可預覽）。
- [ ] 對話歷史摘要（長對話壓縮）。
- [ ] 站內 AI Agent 每日額度調高（待討論，見 0724 Milestone D 區）。
- [ ] `SENTRY_DNS` → 已改為 `SENTRY_DSN`（Luffy 0728 修正，Sentry 可啟用）。

---

## 收工狀態（2026-07-28）
連接半段 + S1 + S2 已審過並 push；F 到「可連、可選檔同步、worker 背景重試」的程度，
差 S3（webhook）、S4（UI）、S5（mock）+ Figma 實測即閉環。內容三池續補待重開高配額 session。
