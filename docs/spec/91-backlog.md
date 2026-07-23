# 完整待辦盤點

> 建立於 2026-07-23。
>
> **為什麼有這份：** `todo_list_0723.md` 只記了「被外部資源卡住」的項目，
> 不是完整範圍。完整範圍原本散在 `10-acceptance.md` 的驗收條件裡，
> 沒有被追蹤成可勾選的清單 —— 那讓「還差多少」這個問題無法回答。
>
> 這份是完整盤點。每完成一項就打勾並在 `90-build-log.md` 補一行。

---

## 總覽

| Milestone | 狀態 | 完成度 |
|---|---|---|
| A — Foundation | ✅ 完成 | 100% |
| B — Visual Personalization | 🚧 進行中 | **約 75%** |
| C — Creative Core | ⬜ 未開始 | 0% |
| D — AI Core | ⬜ 未開始 | 0% |
| E — Daily Loop | ⬜ 未開始 | 0% |
| F — Integration | ⬜ 未開始 | 0% |
| 跨 Milestone：隱私與刪除 | 🚧 部分 | 約 40% |

**Birthday Alpha ＝ A–E 全數通過。** 目前在第二個 Milestone 的後段。

粗略估計：以目前的推進速度，剩餘工作量約是已完成部分的 **3–4 倍**。
D（AI Core）是單一最大的一塊。

---

## Milestone B — 剩餘

### B1. Font System 🔴 被字體檔案卡住

| 項目 | 狀態 |
|---|---|
| 8 套 OFL 字體檔案 | ⬜ **需要人工下載**（見 `todo_list_0723.md` P0） |
| `scripts/build-fonts.ts` 分片腳本 | ⬜ 可先寫，等檔案到位才能跑 |
| 繁中 unicode-range 分片（約 100 片） | ⬜ |
| `fonts` / `font_pairs` seed | ⬜ 表已建好，資料未填 |
| 字體選擇 UI（Theme Studio 內） | ⬜ |
| 字體配對建議 | ⬜ |
| 首屏 < 100 KB 驗證 | ⬜ |
| 換主題時卸載未使用的 `@font-face` | ⬜ |
| `--sr-font-*-id` → 實際 font-family 的解析 | ⬜ 目前 compile 只輸出 id，沒有解析成 family |

> ⚠️ 最後一項是現有的缺口：`compileThemeToCssVars` 產出 `--sr-font-body-id`，
> 但沒有東西把它變成真正的 `font-family`。目前頁面用的是 CSS 檔裡的預設堆疊。

### B2. 影片背景（ADR-019）

| 項目 | 狀態 |
|---|---|
| `feature.videoBackground` flag | ✅ 已定義（預設關閉） |
| 上傳限制（30 秒 / 20 MB） | 🚧 大小已擋，**時長未檢查** |
| poster frame 抽取（需 ffmpeg） | ⬜ worker 目前只處理圖片 |
| reduced-motion 降級為 poster | ✅ 前端已實作，但沒有 poster 可用 |
| 影片暫停控制 | ✅ 已實作 |
| E2E 驗證 | ⬜ |

### B3. Theme / Background 的補漏

| 項目 | 狀態 |
|---|---|
| `time_of_day` 排程的 UI | ⬜ resolver 與 schema 都好了，**沒有介面可以設定時段** |
| `per_login` / `hourly` 播放模式的實際輪播 | ⬜ 後端會回傳，前端沒有計時切換 |
| 三種轉場的實際動畫 | 🚧 只有 fade（CSS keyframe），blur_fade / zoom_fade 未實作 |
| Layout preset（多套版面切換） | ⬜ 表支援，UI 只用第一個 layout |
| Widget config 編輯介面 | ⬜ schema 都定義好了，沒有設定面板 |
| Widget 隱藏 / 鎖定的 UI | ⬜ 欄位與 API 都有，沒有介面 |
| 毛玻璃數量上限（桌機 12 / 手機 6） | ⬜ 規格有寫，未實作 |
| Visual regression 測試 | ⬜ |

### B4. 品質閘門

| 項目 | 狀態 |
|---|---|
| Q1–Q3、Q6–Q9 | ✅ |
| Q4 無障礙 | ✅ 已涵蓋 Theme / Background / Widget |
| Q5 E2E | ✅ 51 項 |
| Q10 手動走一次閉環 | ⬜ **未做** —— 需要人實際操作一遍 |

---

## Milestone C — Creative Core（未開始）

閉環：建立專案、上傳作品、把作品設為背景、從作品一鍵生成主題並套用。

| 區塊 | 主要工作 |
|---|---|
| Project | CRUD、狀態、封面、tag、活動時間 |
| Design | `design_files` + `design_snapshots` 建表與 API |
| Library | 篩選、pg_trgm 搜尋、Asset actions（13 種） |
| 刪除 | 軟刪除 + 30 天寬限 + `asset.purge` job |
| 版本比較 | 並排 / 疊圖 / 滑桿三種模式 |
| Timeline | `event.project` job、投影規則、節流、四種檢視 |
| 本地分析擴充 | 對比檢查、留白比例、textZoneLuminance（目前只有取色） |

**相依：** 無外部阻塞，可直接開始。

---

## Milestone D — AI Core（未開始，最大的一塊）

| 區塊 | 主要工作 |
|---|---|
| `packages/ai-core` | providers（三種協定 / 九家）、router、resolve-usage、cache、keys |
| 斷路器與升級 | circuit breaker、低信心偵測、候選鏈 |
| 額度與成本 | `ai_usage_log`、免費/付費分開計、degraded 降級 |
| Agent | system prompt、context builder、SSE 串流 |
| 五分類 | Fact/Metric/Inference/Suggestion/Creative + `clampStatement` 後處理 |
| 10 個 tool | JSON schema、權限、確認策略、undo |
| Memory | 提案 → 批准流程、pgvector 檢索、Memory Center |
| 設計分析 | light（免費 vision）/ deep（付費）兩條路徑 |

**相依：** 需要至少兩把免費 AI 金鑰（`todo_list_0723.md` P2）。

---

## Milestone E — Daily Loop（未開始）

| 區塊 | 主要工作 |
|---|---|
| 內容池 | **需人工撰寫**：60 quote + 80 prompt + 30 greeting + 各級 surprise |
| 生成 | cron 掃時區、冪等、選取演算法、三段降級鏈 |
| Surprise | 稀有度機率、rare 保底計數器、機率公開頁 |
| 生日鏈 | `availableFrom` 條件觸發；**生日信需人工撰寫** |
| 主動訊息 | 觸發條件、頻率上限、`FORBIDDEN_PATTERNS` 攔截 |
| Insight | 至少 3 種類型、evidence + confidence |
| Notification | in-app、分類、Quiet hours |

**相依：** 內容與生日信必須由人撰寫，不能由 AI 生成（`09-content-pool.md`）。

---

## Milestone F — Integration（未開始）

Figma OAuth、capability matrix、webhook 冪等、同步 job、斷線資料處理。
**相依：** Figma app 憑證 + 正式網域。

---

## 跨 Milestone：隱私與刪除

> `10-acceptance.md` 要求**這一組必須在 Milestone C 結束前完成**。
> 理由：刪除流程若最後才做，會發現前面所有功能都沒考慮 cascade。

| 項目 | 狀態 |
|---|---|
| 刪除單一 asset（含引用檢查） | ✅ |
| 刪除主題 / 背景 / 播放清單 | ✅ |
| 刪除 design snapshot | ⬜ Milestone C |
| 刪除 memory | ⬜ Milestone D |
| 中斷 provider + 刪除派生資料 | ⬜ Milestone F |
| 刪除 space（7 天寬限、R2 先於 DB） | ⬜ **未做** |
| 刪除帳號 | ⬜ **未做** |
| 帳號匯出（zip） | ⬜ **未做** |
| AI 資料聲明頁 | ⬜ |
| 資料地圖頁 | ⬜ |
| `asset.purge` GC job | ⬜ 軟刪除已實作，30 天後的實際清除未做 |

---

## 基礎設施待補

| 項目 | 狀態 | 備註 |
|---|---|---|
| CI 實際執行 | ⬜ | workflow 寫好但無 git remote |
| **CI 改寫為 Zeabur** | ⬜ | 目前 workflow 假設 Vercel |
| Cron 機制 | ⬜ | ADR-008 已改：改用 pg-boss `schedule()` 而非 Vercel Cron |
| `storage.gc` job | ⬜ |  |
| `queue-health` 檢查 | ⬜ |  |
| Sentry / 監控 | ⬜ |  |
| lefthook git hooks | ⬜ | 待 git init |
| Visual regression | ⬜ |  |

---

## 已知的技術債

| 項目 | 說明 |
|---|---|
| `packages/db` 未列在規格 §53 | 已記在 build log，規格本身未更新 |
| migration 編號與規格 §0 規劃不同 | 實際按 Milestone 順序建立 |
| `--sr-font-*-id` 沒有解析成 font-family | 見 B1 最後一項 |
| `apps/web/lib` 的邏輯沒有單元測試 | 覆蓋率只算 `packages/*`；`background-resolver` 等靠 E2E 涵蓋 |
| `QuickNoteWidget` 存在 localStorage | Milestone C 有 notes 表後要遷移；UI 已明說「只存這台裝置」 |
| widget config 沒有 UI | schema 完備但使用者改不了 |

---

## 需要人做的事（我做不了）

| 項目 | 何時 |
|---|---|
| 下載 8 套字體檔 | Milestone B 完成前 |
| 建立 Zeabur 專案與 Supabase | 首次部署前 |
| 建立 Cloudflare R2 bucket | 首次部署前 |
| 建立 git remote | CI 首次執行前 |
| 申請免費 AI 金鑰（至少 2 把） | Milestone D 前 |
| 撰寫 Daily / Surprise 內容池 | Milestone E |
| **撰寫生日信** | Milestone E |
| 決定 Agent 名稱與外觀 | Milestone D 前 |
| 手動走一次 Milestone B 閉環（Q10） | B 收尾前 |
