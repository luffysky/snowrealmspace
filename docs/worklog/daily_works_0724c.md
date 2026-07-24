# Daily Works — 2026-07-24（第三輪）

Luffy。Claude 值班。
主題：**Milestone C 全數完成（C1–C7）→ 主題/背景/背景音樂增強 → Milestone D 基礎**。
承接 `daily_works_0724b.md`。E2E/a11y 依指示不跑，改靠 typecheck / 單元 / RLS / 直連 DB + build 驗證。

---

## ✅ Milestone C — Creative Core（C1–C7 全數完成）

- **C1 地基**：migration 0017–0019。projects/design_files/design_snapshots/design_insights/
  design_connections/provider_webhooks/timeline_events + assets 加 tag/收藏/封存 + pg_trgm。
  RLS 30→37 表、跨 space 隔離測試、`design_snapshots.asset_id` on delete restrict。
- **C2 Project CRUD**：schema（13 測試）+ `/api/projects` + `/projects` UI（狀態篩選/封面/四態）。
- **C3 Library 升級**：篩選（kind/tag/收藏/封存）+ pg_trgm 搜尋 + asset actions（tag/收藏/封存/改名/設為作品）。
- **C4 作品 + 版本比較**：design_files/snapshots API（去重、service role 建 snapshot）+
  compareLocalFeatures（RGB 色距/尺寸/統計，純函式）+ `/works`（並排/疊圖/滑桿 + 數值差異）。
- **C5 Timeline**：event.project 投影 job（規則/節流/冪等）+ 0020 append-only trigger（放行 projected_at）+
  0021 非部分 unique + 三檢視 + 編輯/隱藏/刪除。verify-c5-timeline.ts 直連驗證。
- **C6 from-image 收尾**：3 變體/可重現/textPrimary≥4.5 已測；抽 draftsFromLocalFeatures，
  **並修 C4 compare 巢狀結構 bug**（local_features 是 {colors,composition,dimensions} 非扁平）。
- **C7 隱私刪除組**：findReferences 補 design_snapshot（不可 cascade）/project 封面/timeline 封面；
  資料地圖頁 /settings/data。verify-c7-references.ts 直連驗證。

## ✅ 主題 / 背景 / 背景音樂增強（Luffy 追加）

- 起始主題 4 → 12 套，全過 AA。
- 背景：單色（兩同色停漸層）+ 漸層顏色編輯器。
- 500MB 上限（ADR-022 偏離）+ 影片格式擴充 + audio kind；移除 30 秒時長硬限。
- 影片可選聲音（ADR-019 偏離）：muted 使用者可控，首次手勢解除靜音。
- 背景音樂：space audio + nav 播放器（手動播放）+ 設定頁選音樂/開關/音量。

## 🚧 Milestone D — AI Core（基礎完成）

- **ai-core 路由層純核心**（照搬 AI 島已驗證邏輯，93 測試）：usage-keys、providers（9家/3協定、
  surrogate 清理、計費、cache marker）、errors（換模型判定/低信心）、circuit-breaker、
  candidates（排序/升級/濾付費）、cache-key、default-candidates。
- **runCandidateChain 編排**（§4.5，10 整合測試對應 §11）：fallback/升級一次/缺金鑰跳過/
  真錯直接拋/degraded/全滅拋錯。依賴注入 → 不需金鑰即可完整測試。
- **migration 0023**：7 張 AI 表 + RLS（金鑰僅 service role；用量成員可讀）。
- ESLint 禁 import AI SDK 本就存在。

---

## 🔴 仍需 Luffy 操作（接續 D 與收尾）

- **AI 金鑰**（至少 Groq + Google Gemini 兩把免費）→ callAI/completeForUsage/Agent 才能端到端跑。
- **Zeabur redeploy 最新 commit** → 這輪全部（C 全功能、主題/背景/音樂、D 基礎）才上線。
- hosted DB 套用 0017–0023 migration（我可代灌，但那是動 production，等點頭）。
- 其餘同 0724 🔴 區（Resend、R2、worker、字體檔）。

---

## 兩項 ADR 偏離（Luffy 明確指示，已記 build-log）

- ADR-022：單檔 50MB → 500MB。
- ADR-019：背景影片恆靜音 → 可選聲音。

閘門：typecheck / lint / 單元（含 ai-core 51 + 全套）/ check:rls（43 表）/ db:reset(23) /
web build 全綠。每個 phase 獨立提交。
