# 工作日誌 0727

> 內容衝量日 + 狀態偵測接真實資料。全部經 check:content（去重/安全/id 唯一）＋手動抽讀＋push 自動部署。

## 依使用者近況給內容（狀態偵測接真實資料，`af1e116`）
- 原本每日內容選取的 context 是寫死的 `{tags:[], recentActivityLevel:'normal'}` —— 假值。
- 新增 `packages/daily-engine/src/space-state.ts` 純函式 `deriveSpaceState(events, tz, now)`：讀 `activity_events`
  （ADR-013 真相來源）推 `recentActivityLevel`（7 日活躍天數 → high/normal/low）＋狀態標籤
  `st_returning`／`st_streak`／`st_creating`／`st_decorating`／`st_nightowl`。11 單元測試（含負案例）。
- `service.ts` 改為實讀 30 日 activity_events（service role）→ deriveSpaceState；
  `daily-select.ts` 對 `requiresTag ∈ context.tags` 的內容加權 `STATE_CONTENT_BOOST=8`。
- 新增 `state-aware.zh-TW.yaml` 40 則帶 `requiresTag: st_*` 的內容。

## 全專案假值稽核（Luffy：「整個專案不要有寫死的值」）
- 掃全 repo，唯一「載入型」假值就是上面 service.ts 的 context，已修；其餘為預設/種子值，非假資料。

## 內容衝 4000（多-agent 平行產線）
- **已達標**：quotes 4045／prompts 4001／questions 4000／greetings 1000（每時段 250）收滿。
- **起量續補**：micro_action／seasonal（四季＋天氣氣候，weather-tagged 供 #49）／welcome（回家感、各語氣）。
- 產線：每輪 6–8 個 general-purpose 子代理分不同主題＋不同 id 前綴（check:content 去重是全池的），
  主對話統一 check:content + **手動抽讀** + 反向檢查（welcome/seasonal/micro 不該有問句、questions 必須問句）
  + 撞號檢查 → seed → commit。（見記憶 content-4000-marathon）

## 字體自動安裝移 worker（`font.install` job）
- 避免 HTTP timeout：install route 只入列、UI 輪詢。中文字體（思源黑/宋、昭源…）自動安裝走背景 job。

## 後台 / 主題
- 後台套用主題字體 + 內容池加標籤篩選（`38cc25d`）。
- 主題工作室內建主題分類改橫式 tab（`b7a2f0f`）。

## 待你
- 調高 `CLAUDE_CODE_MAX_SUBAGENTS_PER_SESSION`（建議 1000）重開 session，續補 micro/seasonal/welcome 到 4000。
- AI Agent 每日額度調高方式（待討論，todo Milestone D 區）。
