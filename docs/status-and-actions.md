# SnowRealm Space — 現況與行動清單

> 更新 2026-07-25。這份是「還有什麼沒做、誰要做」的單一入口。
> 里程碑細節見 `docs/spec/91-backlog.md`（已標過時）；外部阻塞見 `docs/todo/todo_list_0724.md`。

---

## ✅ 本階段已完成（大量）

- **媒體庫**：資料夾分類、標籤 chips 篩選、移到資料夾
- **背景**：影片背景、霧面玻璃、非破壞性裁切、漸層編輯器（線性/放射/多點網狀）、
  幻燈片即時生效、**約 50 個內建動態場景**（可疊加、密度可調）
- **隱私與刪除組**（驗收要求）：刪除空間（7 天寬限＋還原＋purge R2 先於 DB）、
  刪除帳號、資料匯出（JSON）；順帶修掉 3 個潛在 cascade/append-only bug
- **上手**：隱私政策/使用條款/使用說明、頁尾、Cookie 同意、**互動 spotlight 教學**（tab 分區、可略過/重看）
- **登入**：記住帳號、magic link 6 位數代碼登入（跨裝置）、美化登入信、註冊同意條款
- **PWA/SEO**：favicon、PWA icon、manifest、OG/meta、robots/sitemap
- **AI 後台**：`/admin/ai-keys`（金鑰）、`/admin/ai/models`（模型）、`/admin/ai/candidates`（候選鏈）、
  `/admin/ai/usage`（用量成本）、`/admin/ai/quota`（每日額度）、`/admin/ai/cache`（回應快取）
- **Agent/內容/系統後台**：`/admin/agent-actions`、`/admin/content`（內容池）、
  `/admin/flags`（Feature Flags 即時切換）、`/admin/system`、`/admin/audit`
- **Agent 語氣**：設定頁可選 warm/gentle/professional/playful/concise → 注入對話與主動訊息（參考 AI 島 persona）
- **修 bug**：多 agent 全專案排查修了 ~15 個 runtime bug（音訊上傳全壞、背景存檔靜默失敗、
  暫停鈕手機點不到、Agent 工具假成功…）＋ 修 R2 上傳 CORS 診斷 ＋ 修 CI mailpit 綁埠

---

## 🟩 我接著會做（不用等你，照序）

1. ~~管理後台其餘頁~~ ✅ 完成（AI 模型/候選鏈/額度/快取/Agent 動作/內容池/Feature flags/系統/稽核）；
   僅剩 **Space／使用者管理** 待做
2. **Lottie 背景**（找免費可商用 .json 動畫來源，接一個輕量 lottie 播放層）
   —— ⚠️ 需引入 lottie 依賴 + 外部動畫素材授權，先與你確認再動
3. **背景樣式圖**再擴充（目前靜態場景已含格線/圓點/光斑/極光/斜紋）
4. **設計原則/本地分析擴充**、SSE 串流、Insight LLM 升級（需金鑰）
5. 每次功能更新同步 **README**

---

## 🔴 只有你能做的（附做法）

| 事項 | 怎麼做 |
|---|---|
| **啟動 Zeabur worker** | 已完成 ✅（上傳處理/場景/排程都靠它） |
| **hosted migrations** | 每次我加 DB 欄位就跑 `pnpm db:migrate`（目前已到 0034） |
| **R2 bucket CORS** | 已貼 ✅（上傳才通） |
| **Zeabur `auth` 服務網址** | 設 `GOTRUE_SITE_URL`／`GOTRUE_URI_ALLOW_LIST`／`API_EXTERNAL_URL` 為正式網域 → 修 magic link 8080 |
| **Resend 寄件人網域** | `service@snowrealm.pet` 驗證 → magic link email 才寄得出 |
| **hosted 登入信模板** | GoTrue env `GOTRUE_MAILER_TEMPLATES_MAGIC_LINK` 指向 `supabase/templates/magic_link.html` 的公開網址 |
| **AI 金鑰** | 到 `/admin/ai-keys` 貼 Groq + Gemini（免費） |
| **字體檔** | 下載 `.ttf`/`.otf`（zip 要解壓）放進 `assets/fonts/<各套>/`，跟我說我幫你分片＋seed |
| **favicon/PWA icon** | 已提供 ✅（我已縮圖接線） |
| **對外開放前** | 換 JWT secret（現為 demo）、robots 改 `index:true`、Google/LINE/Figma 憑證、Q10 手動走查 |

---

## 📌 已知延後 / 技術債
- 桌機 E2E/a11y 已從 CI 移除（Luffy 指示），改靠 typecheck/單元/RLS/直連 DB 驗證
- `apps/web/lib` 部分邏輯無單元測試（靠 verify 腳本）
- 完整里程碑重新盤點（91-backlog 已過時）
