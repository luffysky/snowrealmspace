# 工作日誌 0731

> 修手機 widget 排序 + widget 齒輪改圓 → 接著做「只做一半」全稽核（4 個子代理）並把找到的半成品**全部接成真功能**。經全閘門實跑：typecheck 15/15、917 測綠/2 skip、rls 61、deps/secrets 乾淨。E2E/a11y 依既定暫停。

## 手機 widget 重新排序（bugpic 38/39）

- **症狀**：手機版進「編輯版面」後，widget 只是單欄堆疊，**沒有任何調整位置／順序的 UI**。桌機/平板是拖曳格線，手機沒有格線可拖，等於行動版根本無法排序。
- **根因**：`HomeGrid.tsx` 的行動版分支只 `sort by position.mobile.order` 後直接 render，沒給任何控制項；且 `commit()` 對 mobile 直接 early-return。**但 bulk API 其實早就支援** `{ breakpoint:'mobile', items:[{id, order}] }`（`widgets/bulk/route.ts` 有專門的 mobile 分支寫 `position.mobile.order`）——缺的純粹是前端入口。
- **修法**：
  - `HomeGrid.tsx` 新增 `commitMobileOrder(orderedIds)`：把可見 widget 重新編號 `order = index`，樂觀更新本地狀態 + 打 bulk API，失敗回滾並提示。
  - 行動版分支改成：算出排序後的 `ordered`，每個 slot 在編輯模式多出 **↑／↓ 上移/下移**兩顆鈕（`move(index, dir)` splice 換位後 commit）；首/末項對應鈕 `disabled`。
  - 編輯模式加一行手機專屬提示：「用每個區塊左上角的 ↑ ↓ 調整順序，這個順序只影響手機。」
  - `globals.css` 加 `.sr-mobile-reorder`（絕對定位右上角，避開左上角 ⚙ 設定）＋ `.sr-mobile-reorder-btn`（44×44 合 WCAG target size、disabled 半透明）。
- **驗**：web typecheck / lint 綠。E2E mobile 依 [[e2e-a11y-paused]] 暫停未跑；既有 `e2e/widgets.spec.ts` 的手機測試只驗檢視模式（stack 可見、grid=0），不受影響。

## widget 設定齒輪改圓形（commit 23c85a5）

- 原本「⚙ 設定」pill（`border-radius:999px` 只圓兩端）→ 改 icon-only 44×44 圓鈕，與行動版 ↑↓ 一致；可及性靠 aria-label + title。

## 「只做一半」全稽核（4 個平行子代理）

沿用手機排序 bug 的形狀（後端有、前端沒接），對整個 repo 掃「只做後端沒前端 / 只做前端沒後端」：
- **API↔前端**：20 個後端能力沒 UI（agent 審批流、主題最愛/版本/刪除、作品編輯、AI 金鑰預算/停用、素材翻頁、goals unit…）。
- **widget config↔元件**：16 個「面板生得出、元件不讀」的假設定（我逐一確認 registry 有宣告、元件 0 引用）。
- **DB 欄位↔程式**：surprise_pity_counter / vision_features / ascent_descent_override 等 dead schema（多為 migration 標「延後」）。
- **Feature flag↔強制**：videoBackground / weeklyRecap 兩個 flag 是裝飾品（功能全上線、flag 從不讀）。

## 全部接成真功能（Luffy 指定 Tier1+Tier2 都接）

- **W1（c0c490f）** 16 個假 widget 設定全接（daily archive 連結、surprise 稀有度/登入自動開、agent 頭像/多則/回覆、current_project 進度/近期作品、recent_designs grid-carousel/專案篩選、quick_note 草稿自動存/存到專案、creative_streak 視窗天數）。background_control 的 allowSkip/allowPause 因無控制通道**移除**，ADR-019 暫停保證改盯 BackgroundLayer 真實 PausePortal 的測試。
- **F（8ebfe9c）** videoBackground（backgrounds POST + Studio gate）、weeklyRecap（worker per-space gate）變真閘門。**注意：兩 flag 目前關著 → 部署後這兩功能會關，要用去後台開。**
- **T（87066bd）** 主題 ♥ 最愛切換 → showFavoritesOnly 篩選閉環。
- **Tier2-A（5855422 / 5b99659）** agent 對話動作卡片 + 確認/拒絕/復原；Theme Studio 版本歷史/還原 + 刪除主題。
- **Tier2-B（73d673d / c9149ed）** goals 單位輸入；AI 金鑰每月預算/停用（含 deps.getKey 超支跳過 + logUsage 累計 used_this_month + 跨月重置的**真把關**）；作品改名/描述/標籤；素材庫 cursor 翻頁 +「載入更多」；音訊篩選。
- **Tier2-C（3d044e3）** 背景對比滑桿；幻燈片切換淡入淡出時長；筆記標題；捕捉「已封存」清單 + 放回 Inbox。

**未接（非破損、刻意）**：projects/design-files 伺服器篩選（前端 client-side 篩選本就可用）、GET /api/memories（頁面走 SSR 冗餘）、DB dead schema（多為 migration 標延後）。

## #55 內建背景擴充 + 套件化下載（完成）

- **+35 場景**（scenes.ts 302→335，六分類；去掉 13 個撞名近似項）。
- **套件化下載**：新 `apps/web/lib/scene-packs.ts`（6 分類 + Lottie = 7 套件）；BackgroundStudio 加 per-space「已取得」狀態（localStorage）、未取得可預覽（🔒）、取得後可套用、分頁/卡片鎖標 + 取得橫幅。honest「收進你的空間」模型，非假網路下載；既有已套用背景不受影響。commit ae54b98 / f213fab。

## #50 內容補量（大批，已 seed 上 hosted）

- **greeting 4019**：268→4019。4 輪各時段 4 子代理，自寫組裝器 `scratchpad/assemble_greetings.py`（全池近似去重 + FORBIDDEN + night 不催促 + 長度）過 check:content。中途改子代理直寫檔案（只回 done）省 token。batch 20–24。
- **milestone 205 / surprise 999**：里程碑各節點+generic 適度擴充；驚喜盒各 rarity 續號（label+text+tags）。通用組裝器 `assemble_pool.py`（全池去重 + 保留 tags/label）。**坑**：surprise id 我先誤用 entry 數當最大號 → 撞號，改依各 rarity 真實最大號（common 311+/uncommon 273+…）續號才過。commit d38bc29。
- **三池 round1**：micro/seasonal/welcome 各 +~800（1955/1932/1940→2752/2731/2736），6 子代理直寫 + assemble_pool，`-x1-` 批次 infix 免撞號。commit 347f771。續朝 4000 各差 ~1250。
- 全程 `pnpm seed:content` 灌 hosted（Zeabur，upsert 冪等，22572 則）。

## 待辦全稽核（子代理，對照實際程式）

- 確認一堆 backlog/0724 標「未做」其實**早做了**（對話歷史摘要、富文本、textZoneLuminance、公開作品集/分享、Email 週報、#55 套件化）。
- 真正沒做又沒卡的只剩：**裝飾品擴充**（81 SVG 多表情臉、0729 提過）、協作、i18n、經濟層(Trust/AI Dot)、型別重生(S)、output:standalone(S)。
- 校正後的權威狀態寫進 `docs/todo/todo_list_0731.md`。

## 待你

- **重要**：redeploy 後若要用**影片背景 / 每週回顧**，到 **後台 → Feature Flags 開 `videoBackground` / `weeklyRecap`**（部署後預設關）。
- 手機實機確認 widget ↑↓ 排序、圓齒輪不擋內容。
- 有空實測這批新入口（主題版本/最愛、作品編輯、AI 金鑰預算、素材翻頁、捕捉還原、agent 動作確認、背景商店套件取得）。
- 三池續補到 4000（產線成熟，說「繼續」即可）；下一個純程式建議做**裝飾品擴充**。
- Canva A/B、Lottie 素材、#55 第7類 仍等你開 live session（見 `todo_list_0731.md`）。
