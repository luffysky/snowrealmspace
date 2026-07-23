# SnowRealm Space — 可執行規格

> **從這裡開始。**
> `docs/SnowRealm-Space-Full-Spec-v1.0.md` 是產品憲章，回答「為什麼」與「要做什麼」。
> 本目錄回答「怎麼做」，是實作時的真相來源。

---

## 兩份文件的關係

| | v1.0 憲章 | `docs/spec/`（本目錄） |
|---|---|---|
| 回答 | 為什麼做、要做什麼、不做什麼 | 怎麼做、做到什麼程度算完成 |
| 讀者 | 所有人 | 工程師、Claude Code、Codex |
| 變更頻率 | 低（產品方向變才改） | 高（隨實作演進） |
| 衝突時 | **以本目錄為準** | ← |

v1.0 在「為什麼」這層寫得很好——尤其 §4.4（AI 不做無證據推測）、§5.2（證據優先）、§5.5（不做情緒操控）、§5.6（功能必須形成閉環）。這些原則在本目錄中被翻譯成具體的資料結構、後處理器與測試案例，而不是靠自律。

---

## 目錄

| 檔案 | 內容 | 何時讀 |
|---|---|---|
| `01-decisions.md` | **ADR。所有決策的真相來源。** v1.0 §57 的 20 項未決全數收斂 | 動手前必讀 |
| `02-domain-model.md` | 實體、關係、生命週期。解決 `assets`/`design_files`/`backgrounds` 衝突 | 動手前必讀 |
| `03-database.md` | 完整 DDL、索引、RLS policy、刪除流程 | 寫 migration 時 |
| `04-api-contract.md` | 全部端點、zod schema、錯誤碼、分頁、速率限制 | 寫 API 時 |
| `05-theme-tokens.md` | Token → CSS 變數映射、對比規則、繁中字體分片 | Milestone B |
| `06-widget-contract.md` | 格線、碰撞、config schema、錯誤隔離、鍵盤操作 | Milestone B |
| `07-agent.md` | System prompt、五分類、10 個 tool schema、context 預算、undo | Milestone D |
| `08-jobs-events.md` | 事件型別、Timeline 投影、Queue、Cron、GC | Milestone A 起 |
| `09-content-pool.md` | Daily/Surprise 內容池、選取演算法、生日鏈 | Milestone E |
| `10-acceptance.md` | **每個 Milestone 的驗收條件** | 每個 Milestone 開始與結束 |
| `11-engineering-setup.md` | Monorepo、環境變數、lint、測試、CI、部署 | Milestone A |
| `12-ai-model-routing.md` | 多模型路由：免費優先、候選鏈、斷路器、升級 | Milestone D |
| `13-third-party-auth.md` | Google / LINE 第三方登入規劃（V1 才實作） | V1 前置 |
| `90-build-log.md` | **實作與規格的偏離紀錄。** 每個 Milestone 結束時更新 | 動手前必讀 |
| `91-backlog.md` | **完整剩餘工作盤點。** 回答「還差多少」 | 排工作時 |

---

## 四個已拍板的決策

| 決策 | 結果 | ADR |
|---|---|---|
| 交付節奏 | 無硬期限，Milestone 閉環優先 | ADR-001 |
| 技術棧 | Next.js + Supabase + Cloudflare R2 | ADR-002 |
| 登入 | Magic link + 多租戶 RLS 從第一天 | ADR-003 |
| AI | **多模型、免費優先、必要才升級付費** | ADR-023 |

第四項移植自 `D:\SnowRealmRebirth\AI\ai_island_v3` 的既有實作。

---

## 給 Claude Code / Codex 的執行指示

取代 v1.0 §54 的 prompt：

```text
你正在實作 SnowRealm Space。

## 開始前

1. 讀 docs/spec/01-decisions.md（全部）。它是決策真相來源。
2. 讀 docs/spec/02-domain-model.md。理解 assets / design_files /
   background_items 的關係，這是最容易做錯的地方。
3. 讀 docs/spec/10-acceptance.md 中你要做的那個 Milestone。
4. 檢查目前 repository 狀態，判斷上一個 Milestone 是否真的通過。
5. 產出：gap 分析、實作計畫、migration 計畫、路由圖、風險清單。

## 實作規則

依序做，不跳關：
  Milestone A → B → C → D → E → F

每個 Milestone 結束前，10-acceptance.md 的通用品質閘門 Q1–Q10 全部通過。
未通過不得開始下一個 Milestone。

## 不可違反

1. 每張帶 space_id 的表都必須有 RLS policy 與跨 space 拒絕測試。
   忘記寫 policy 會讓 pnpm check:rls 失敗，這是刻意的。
2. 授權一律用 space_id，永遠不用 created_by / owner_id（ADR-006）。
3. 位元組只存在 assets 與 asset_renditions。其他表出現指向使用者檔案的
   URL 欄位就是設計錯誤（ADR-005）。
4. 不得直接 import 任何 AI 廠商 SDK。一律走 @snowrealm/ai-core 的
   completeForUsage()（ADR-023）。
5. 不得在 component 中寫死顏色。一律用 --sr-* token。
6. 不得假造 provider 資料。不得假造 AI 分析。不得留假按鈕。
7. 未完成的功能藏在 feature flag 後，且 flag 關閉時路由與 API 都回 404。
   只隱藏按鈕但保留可存取端點，是假關閉。
8. Agent 沒有刪除、封存、中斷連線、對外分享、上傳第三方的工具。
   這些能力根本不提供，而不是「要求確認」。
9. AI 呼叫預設走免費模型。只有 tool calling、使用者主動要求深入分析、
   以及免費模型低信心三種情況才升級付費。
10. 嚴格 TypeScript。所有 API 輸入以 zod 驗證。
11. 每個完成的流程都要有測試。
12. 每個 Milestone 後跑 lint、typecheck、test，不得靜默忽略失敗。
13. 每個 Milestone 後回報：變更的檔案、通過的驗收條件、剩餘風險。

## 遇到規格沒寫到的情況

不要自行發明並繼續。停下來，說明缺什麼、你打算怎麼假設、影響哪些部分。
規格有缺口是正常的，隱藏缺口不是。
```

---

## v1.0 的哪些內容已被取代

| v1.0 § | 狀態 | 取代於 |
|---|---|---|
| §12.2 `BackgroundItem`（含 sourceUrl） | 取代 | `02-domain-model.md` §3.5 |
| §34.1 表列中的 `backgrounds`、`asset_versions` | 取代 | `02-domain-model.md` §7 |
| §34.5 `backgrounds` DDL | 作廢 | `03-database.md` §5 |
| §34.7 `design_files.owner_id` | 取代 | `space_id` + `created_by` |
| §35 API 路徑列表 | 擴充 | `04-api-contract.md` |
| §39.1 單一 Provider 抽象 | 擴充 | `12-ai-model-routing.md` |
| §57 全部 20 項未決 | 收斂 | `01-decisions.md` 決策對照表 |

v1.0 的其餘內容（§1–§11、§13–§33、§36–§56）仍然有效，本目錄是它的實作層。

---

## 仍然開放的問題

以下不阻塞任何 Milestone，但需要專案負責人在標示的時點回答：

| 問題 | 需在何時決定 | 影響 |
|---|---|---|
| Agent 的名稱與外觀 | Milestone D 開始前 | `agent_profiles` 已預留欄位，改動成本低 |
| 生日信的內容 | Milestone E 前 | `content/letters/birthday-letter.md`，由人撰寫不由 AI |
| 生日鏈 `chainIndex: 4`（一年後）要放什麼 | Milestone E 前 | 同上 |
| 是否加入背景音樂 | V1 | 獨立 widget |
| 正式產品名稱 | 公開發布前 | 程式碼用 `snowrealm` 前綴，品牌字串走 i18n |
| Nami Space 是獨立品牌或 template | V1 | ADR-003 的多租戶讓兩者都可行 |
| 公開 Portfolio route | V2 | 在 `feature.publicPortfolio` 之後 |

---

## 這份規格自己的驗收標準

一份規格是否可執行，看它能否讓人在**不問作者**的情況下寫出正確的程式碼。判準：

1. 每個資料表都有完整 DDL、索引與 RLS？→ `03-database.md`
2. 每個 API 都有 request/response schema 與錯誤碼？→ `04-api-contract.md`
3. 每個 AI 呼叫都知道用哪個模型、花多少錢、失敗怎麼辦？→ `12-ai-model-routing.md`
4. 每個 Agent tool 都有 JSON Schema、權限、確認策略與 rollback？→ `07-agent.md`
5. 每個 Milestone 都能明確判斷「做完了沒」？→ `10-acceptance.md`
6. clone 之後能跑起來？→ `11-engineering-setup.md` §12

若某一項答不出來，那是規格的缺口，不是實作者的問題。
