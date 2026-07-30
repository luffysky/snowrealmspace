# 待辦狀態校正 0731

> 這份是 2026-07-31 收工時**對照實際程式**校正過的權威狀態。
> 取代 `todo_list_0728.md` / `91-backlog.md` 裡過時的「未做」標記（那些多半其實做了）。
> 歷史與外部憑證細節仍指回 `todo_list_0724.md`。

---

## ✅ 這次 session 做完的（都已 commit/push 上 main）

### 「只做一半」全稽核 → 全部接成真功能
- 16 個假 widget 設定全接（daily 封存連結、surprise 稀有度/登入自動開、agent 頭像/多則/回覆、current_project 進度/近期作品、recent_designs grid-carousel/專案篩選、quick_note 草稿自動存/存到專案、creative_streak 視窗天數）。background_control 兩個無控制通道的開關移除，ADR-019 暫停改盯 BackgroundLayer 真實 PausePortal 的測試。
- 主題「我的最愛」切換 → showFavoritesOnly 篩選閉環。
- **videoBackground / weeklyRecap** 兩個裝飾 flag 變真閘門（⚠ 部署後預設關，要用去後台 Feature Flags 開）。
- agent 對話**動作卡片 + 確認/拒絕/復原**；Theme Studio **版本歷史/還原 + 刪除主題**。
- goals 單位輸入；AI 金鑰**每月預算/停用**（含 deps.getKey 超支跳過 + logUsage 累計 + 跨月重置的真把關）；作品**改名/描述/標籤**；素材庫 **cursor 翻頁 + 音訊篩選**；背景**對比**滑桿；幻燈片**切換時長**；筆記**標題**；捕捉**已封存還原**。

### #55 內建背景擴充 + 套件化下載 —— 完成
- +35 個新 procedural 場景（302→335，六分類）。
- **套件化下載**：`apps/web/lib/scene-packs.ts` + BackgroundStudio 的 pack 收藏（未取得可預覽、取得後可套用、per-space localStorage、🔒 標示）。0728 標「套件化下載未做」是**錯的**，已做。

### 手機/UI
- 手機 widget ↑↓ 排序（bugpic 38/39）；widget 設定齒輪改圓形圖示鈕。

### #50 內容補量（已 seed 上 hosted）
- greeting **4019** ✅（268→4019，各時段~1000，過 10 年門檻）
- milestone **205** ✅（30→205，各節點+generic 適度擴充）
- surprise **999** ✅（645→999，≈1000）
- **三池進行中**：micro-actions **2752** / seasonal **2731** / welcome **2736**（1955/1932/1940 起，round1 各 +~800，續朝 4000，各差 ~1250）
- quote 4045 / prompt 4001 / question 4000 早已達標
- **chain 維持 5**（生日敘事故事，非隨機池，不補）

---

## 🔁 文件過時、其實早就做了（backlog/0724 標「未做」是錯的）
- 對話歷史摘要（`lib/agent/summarize.ts` + chat/stream 都接了）
- 富文本輸入（tiptap + emoji + giphy，`components/rich/*`，capture/notes/agent 都用）
- textZoneLuminance 本地分析（worker asset-process + theme-engine compare）
- 公開作品集 / 唯讀分享連結（`(public)/p|w|s` + `/api/share`）
- Email 週報 channel（Resend，migration 0047）
- #55 套件化下載（見上）

---

## 🔴 真正還沒做（純程式、沒被外部卡）
1. **裝飾品擴充** —— manifest 還是 81 個靜態 SVG、多是表情臉（0729 提過）。減表情臉 + 加動物/植物/食物/物件 ~150+。**建議下一步做這個。**（M）
2. **協作 / 訪客編輯** —— 目前只有唯讀作品集+分享；多人協作沒開始。（M）
3. **i18n 全站多語** —— 無框架/語系檔。（L）
4. **Trust Level L0–L3 / AI Dot 帳本（經濟層）** —— 只有 profiles.privileged；也卡決策。（L）
5. **型別正式重生**（user_sessions，0059 後手改；需本地 Docker 跑 gen types；typecheck 目前綠）。（S）
6. **`output:'standalone'`**（刻意為 image size 延後）。（S）

## 🔒 卡外部（需你給憑證/開 live session/素材）
- Figma/Canva 端點·scope 實測 + S5 真實 fixtures（provider-core 26 個 TODO，錄放框架已建，只差真連線）
- Canva A（整資料夾）/ B（全頁匯出）—— 需開 Canva session 錄真 API
- Adobe 整合（需憑證，你說之後用；另需 design_connections.provider 加 adobe）
- #55 免費商用 Lottie / 動漫背景（第7類~350）+ Lottie 動態裝飾 —— 需 LottieFiles 素材 session
- /api/health 全綠（程式完整，差部署環境 R2+worker）、JWT secret rotation、台北黑體字檔、Q10 手動走查、內容決定（AI 命名/生日鏈第5環/正式產品名）、RWD 手機 E2E 補驗（依你暫停）、preview/prod 環境分離

---

## 📌 明天(0801)要寫的 spec —— Coco 經濟 × 能力鏈（跨專案：Platform / AI島 分身島）

**目標**：把「文字 track 的 3 階能力鏈 + Coco 帳本 schema + 洗錢防呆規則」寫成一份可執行 spec。
> 背景：0731 晚上與 Luffy(＋GPT)腦力激盪的「共用 Agent 腦 / 真 skill 商店 / Coco 貨幣」三合一 RPG 經濟。
> 前提已查證：AI島 skill 商店是**真的**(~82% REAL、MCP 外部 skill 可接、有 skill-synthesis)；已有 `z_coin`(使用者幣)，但**無 agent 經濟層**。Coco = 軟幣、不可換回真錢、可單向 z_coin→Coco。

spec 要涵蓋：
1. **文字 track 3 階能力鏈**：copy-writer(已 REAL)為 T1；T2/T3 解鎖條件 = `XP 門檻 AND Coco 花費 AND 前置 skill`。兩軸分開：**XP＝實戰(每完成真任務得經驗)**、**Coco＝入場券/加速**。骨架手刻、葉子交給 skill-synthesis＋MCP＋社群長。
2. **Coco 帳本 schema**：`agent_wallets(agent_id, coco)` + `coco_transactions`(append-only、冪等、單一帳本 —— 與 z_coin / AI Dot 同一個 Economy 服務，**不開第 4 套 fork**)。source＝使用者發薪/任務賞金；sink＝解鎖 skill / 算力 / 外包 / 打賞。
3. **洗錢/濫用防呆(必寫)**：
   - **faucet 只在使用者側**(agent↔agent 是零和重分配)；新分身出廠帶「能跟使用者賺錢」的 REAL skill。
   - **XP 洗澡防呆**：peer(agent 出錢)任務給的 XP 打折/設上限，user(使用者出錢)任務給全額 → 互刷賺不到有效經驗。
   - **花錢動作要授權可見**：分身外包/解鎖走**使用者給的自主額度**(呼應 Space 鐵則 #8：agent 對外/花費動作可見可控)。額度內＝驚喜、無邊界＝驚嚇。
   - sink 要好花、faucet 要費力/付費 → 防通膨與死池。
4. **V1 最小迴圈**：只做文字 track、使用者出賞金、解鎖花 Coco、一個「外包」動作綁可見額度、一張分享卡(賺了 X/學會 Y/接了 Z 案)。先跑通迴圈再長樹。
5. 放哪：屬 Platform/AI島 範疇(種子＝ai_island_v3 的 orchestrator+tools+MCP+skill-synthesis)；spec 可放 `docs/spec/` 或 platform 規劃夾，並回連 `SnowRealm-Platform-Planning.md` 的 Economy 段。

## 待你
- **重要**：要用**影片背景 / 每週回顧**，到 後台 → Feature Flags 開 `videoBackground` / `weeklyRecap`（部署後預設關）。
- 三池（micro/seasonal/welcome）續補到 4000：產線已成熟（`scratchpad/assemble_pool.py` + 6 子代理/round），說「繼續」即可再跑；每 round 各 +~800。
- 下一個純程式項目建議：**裝飾品擴充**。
