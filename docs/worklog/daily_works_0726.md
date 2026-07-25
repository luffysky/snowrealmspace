# 工作日誌 0726

> 大量進度日。全部經閘門（typecheck/lint/rls/deps/build，多處 next start 或直連 DB 實測）＋ push 自動部署。

## 生態調查 → 平台規劃
- 派 agent 讀完全部七個 repo（AI島／Insight／YukiBoard／MD2Deck／多聞雷達／毛行天下＋Space）。
- **核心發現**：平台能力不是綠地——**AI Router 已 5 套、Z 幣 4 套、各自 Auth**。整合＝收斂，不是建置。
- 改寫 `SnowRealm-Platform-Planning.md` ＋ `SnowRealm-Platform-todo.md`：補每產品現況、收斂種子、兩兩搭配可行性。

## Agent 多模態
- **圖片(vision)**：走既有 assets 管線（ADR-005），伺服器讀位元組轉 base64，帶圖走新 `agent_chat_vision` 候選鏈（gemini/llama-vision 免費優先），持久化 `agent_messages.blocks` 供歷史重繪。
- **檔案**：前端讀文字檔貼進輸入框（不落地）。
- **語音**：`/api/agent/transcribe`（Groq whisper-large-v3-turbo）→ 轉寫填輸入框（不自動送）。沒金鑰誠實跳過。

## 🐛 生日通知 critical bug（旗艦功能靜默失敗）
- `notifications.category` CHECK 不含 `'birthday'`，但 daily-cron 送 `category='birthday'` → insert 拋錯被 try/catch 吞、`birthday_greeted_year` 沒更新 → **Nami 生日(7/24)當天站內祝福靜默失敗**。0044 補上。
- 順手：`/api/agent/message` 改只讀，proactive 收斂到 cron 一條路徑（消除競態）。

## 新功能
- **4 個 widget**（0045 mood_entries+goals）：專注計時／心情打卡／目標追蹤／創作連續；on_this_day 本就可用。`sync-widget-defs.ts`（不清 flag）。
- **隨手捕捉 inbox**（0046 capture_inbox）：`/capture` 丟念頭 → 轉筆記/封存/刪除；source 支援 yukiboard/agent（YukiBoard 鉤子落點）。
- **公開作品集**（0048 visibility + 0049 anon RLS）：作品三態 private/unlisted/public；`/p/[slug]`、`/w/[id]`；`createPublicClient` 純 anon；`/api/public/asset-url` 先驗證再簽 URL。**安全實測：anon 零 private 洩漏。**
- **分享連結**（0050 share_links）：`/s/[token]` 唯讀、可設到期、可撤銷，**對私人作品也有效**（token=授權，service-role 驗）。四情境實測（無token/過期/撤銷皆拒）。
- **Email 週報**（Resend）：0047 opt-in 開關；`apps/worker/src/email.ts`；沒 `RESEND_API_KEY` 誠實跳過。
- **筆記 CRUD**：`/api/notes` + `/notes` 頁；QuickNote widget 從單格 → 多則 CRUD（改存 notes 表）。
- **帳號匯出 ZIP**（fflate）：data.json + assets.csv + README。

## 基礎設施
- **lefthook**：pre-commit(secrets+lint) / pre-push(typecheck+deps)；實測 Windows+pnpm 環境正常。
- **Sentry-lite**：DSN-gated（設 `SENTRY_DSN` 才啟用），零 build 風險。
- **CI**：查證 e2e/a11y 早已移除、無 Vercel 假設 → 「改 Zeabur」其實已完成。

## 平台身份 prep（ADR-024）
- **識別介面** `lib/auth/identity.ts`：全站唯一讀身份處，session/context/site-admin 都收斂過去。換 SSO 只改一檔。
- **0051**：`profiles.snowrealm_id`(unique) + `snowrealm_linked_at` + `snowrealm_link_method`（先備不啟用）。
- **ADR-024**：Space 當 OIDC client；綁定「明確為主、已驗證 email 為輔」（坑#1）；解綁軟刪+資產守衛（坑#3）。
- 策略看法寫進 `docs/platform.md`（兩個時鐘、OIDC 標準、product_key 註冊表、Space 當白老鼠）。

## 全專案接線審計（3 agent）
- **API↔DB**：全清——每條路由的表/欄位都對得上 generated types，零 mismatch。
- **UI↔後端**：全部路由/header/nav 對齊，**只 1 個 bug**：Theme 匯出 JSON 用 `<a download>` 少 x-space-id → 下載 401 blob。**已修**（改 fetch+blob）。
- **RWD**：極乾淨。2 個小修：WorksClient 標題列加 flex-wrap/min-width:0；A11yPanel 表格包 overflow-x。

## 修的 UI/UX bug
- 幻燈片命名（空白預設+建立後清空+Enter 建立+既有清單就地更名）。
- 側邊欄桌機 sticky（內容捲動不跟著動）。
- Theme 手機版預覽改 sticky（往下調當下看得到；背景編輯器本就即時）。

## 待你
- **Zeabur 環境變數**：`RESEND_API_KEY`+`RESEND_FROM`（週報 email）、`SENTRY_DSN`（監控）。
- **平台決策**：開 `snowrealm-id` 專案 → 我接 Space 成 OIDC client + 綁定流程。
- 外部：字體檔、Figma 憑證、AI Dot 定價。
