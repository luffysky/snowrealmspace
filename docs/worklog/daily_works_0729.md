# 工作日誌 0729

> 大日：修破版 + 全站 RWD 稽核 + Milestone F 收尾(S3/S4) + 天氣功能整套(#56/#49) + 四份法務/說明文件更新。
> 工作法照舊「子代理寫、主對話逐檔審 + 獨立重跑閘門」。經 lint/typecheck/check:deps/check:secrets/**full test suite(849)**，並對 **hosted DB 落地驗證**。

## 通知面板手機破版(bug，bugpic/37，`bc76a2a`)
- **症狀**：通知鈴鐺展開的面板在手機超出視窗右緣、每則文字被切掉。之前「以為修過」(0724 有記 fixed)。
- **根因**：手機 `@media(max-width:767px)` 的 `.sr-notif-panel` 覆寫寫在**基準規則之前**(L979 vs L2645)。
  media query **不加 specificity**，同 specificity 下**後者勝** → 基準的桌機定寬 popover 永遠蓋掉手機覆寫 = 死碼。
- **修法**：把手機覆寫移到基準之後，加 `min-width:0`/`overflow-wrap`。並寫了個 CSS「media-before-base」偵測腳本掃全檔，確認**只有這一處**。

## 全站 RWD 稽核(`bc76a2a`)
- 子代理逐一查所有浮層(dialog/agent 面板/VRM/emoji-gif/導覽 tip/cookie/漂浮球)→ 都已正確夾住視窗，破版排序 bug **僅通知面板一處**。
- 順手修 3 個資料相依溢位：`.sr-playlist-item`(背景名)、`.sr-works-item`(作品標題)長字串 → `minmax(0,1fr)`+`min-width:0`+`overflow-wrap`；`.sr-tour-tip` 直式無捲動 → 加 `max-height`+`overflow`。
- 8 個 `repeat(auto-fi..)` 格線統一成專案安全寫法 `minmax(min(100%,N),1fr)`(零視覺變化、僅窄容器時改為收斂不溢位)。

## Milestone F — sync 收尾(`cd3fe3a`)
- **S3 webhook 觸發同步**：`/api/webhooks/[provider]` 接上 canva(figma passcode／canva HMAC)，驗簽+非重送才觸發，
  找受影響 `design_files`(sync_status=active、connection status=active)逐列入列 `design.sync`(與手動同步同契約)。
  provider-core 加 `affectedFileExternalIds`(Figma file_key／Canva design.id 防禦性，掛 TODO(canva))+8 測試。
  審查時對 0017 schema 核對欄位真實存在(`design_files.provider`/`sync_status`、`design_connections.status`)。
- **S4 選檔 picker UI**：`FilePickerDialog`(列 `/files`、勾選送 `/sync`、Figma 需專案 ID、無全選、上限 50、誠實狀態、`.sr-dialog-picker` 行動安全)；
  `/files` 每檔標真實 `design_files.last_synced_at`(單一 RLS 查詢)；版本比較確認 `/works` 已涵蓋(查詢無 provider 濾鏡)→ 不重造。
- **關鍵決定**：F 程式面到此完成(連接+S1+S2+S3+S4)。剩 S5 mock 與 Figma/Canva 端點實測**卡真實連線**(env 已備、待第一次端到端跑)。

## 天氣功能(#56 + #49，`0b907e3`)
- **#56 天氣 widget**：日/夜(太陽/月亮)+氣溫+地區+`ProceduralScene` overlay 動畫(晴/雨/雪/雷/颱風)；reduced-motion/省流量自動靜態、可暫停(ADR-019)。6 種誠實狀態。
- **來源決定**：選 **Open-Meteo(免金鑰)**，不想再多一個外部憑證；伺服器 proxy `/api/weather`(讀該 space 存的城市、不吃 URL 參數) + `/lookup`(座標只進 body)。10 分快取。
- **隱私(預設關)**：只存**城市名**、不存座標；flag `weatherWidget` gate(關→404)。「使用目前位置」用 BigDataCloud 反查城市名——
  這會把精確座標傳給第二個外部服務，**經 Luffy 確認保留**(手動輸入為主、沒填才定位)，並已在**隱私政策誠實揭露**(座標換名後即丟棄、不儲存)。
- **#49 天氣感知內容**：抽 `@snowrealm/weather` 套件解 daily-engine 分層(package 不能 import app)；生成時查天氣 → `conditionToContentTags` 轉既有 tag(sunny/rainy/cold/hot…)併入 context；
  `selectSeasonal` 讓本來只依節氣過濾、**長年選不到的 ~1700 則天氣 seasonal 內容**真的被選中。**韌性**：天氣失敗一律 try/catch→`[]`，8s timeout，絕不阻斷每日生成。選取仍決定性(seed 不含天氣)。
- **bug(full suite 才抓到)**：targeted 測試全綠，但 `pnpm test:coverage` 跑全套抓到 `registry.test.ts` 一條過時斷言
  `getWidgetDefinition('weather')).toBeNull()`(weather 曾是未實作 future widget)。改用仍未實作的 `calendar` 驗證。**教訓：收尾一定跑 full test suite，不能只信 targeted。**

## hosted DB 落地(Luffy 點名的「腳本沒跑表沒建」風險)
- 對 **hosted**(snowrealm-space-db.zeabur.app)跑 `sync-widget-defs.ts` → `widget_definitions` 補 `weather`(14 個 widget，idempotent upsert，不碰 flags)。
- 補 `feature_flags.weatherWidget`(enabled=**false**，天氣仍關、待後台開)。
- **驗證**：查回 `widget_definitions.weather` 存在、`feature_flags.weatherWidget` 存在且 disabled。沒這步 → 新增 widget 會 FK 違反、天氣讀不到。

## 文件(privacy/terms/guide/cookie + 進度)
- 隱私政策：補第三方登入(Google/LINE)、外部整合(Figma/Canva token 加密)、位置與天氣、Email(Resend)、第三方服務清單；日期→0729。
- 使用條款：新增「第三方服務與整合」節。使用說明：加「外部整合」+「天氣」兩節。Cookie 橫幅：補第三方登入 session cookie、仍無追蹤。
- README、todo_0724/0728 更新;憑證待辦劃線(Luffy 已設好 AI 金鑰/F 憑證+開 flag/Resend/Google-LINE+隱私頁)。

## 下半場（同日續：作品 AI／Adobe／天氣搜尋／多帳號／後台上線資訊）

### 作品 AI 對話 + 分析歷史 + 長期記憶（`fc2617d`）
- /works 視覺分析改可對話：WorkChat 沿用 Agent SSE + 多模態（首輪附設計圖，反幻覺要求真的看到圖）+ 空間級長期記憶（pgvector）。
- 分析不再 ephemeral：寫進 `design_insights` 存歷史，列「時間·來源軟體(provider)·專案·版本·模型」。per-work thread 用 `agent_messages.context_refs` 綁定（免 migration）。

### Adobe 連接骨架 + Figma scope env + 修 picker flag（`2734bdd`）
- Adobe 加為 provider（flagged adobeExpress、卡憑證、端點 TODO、顯示尚未設定不擺假按鈕，全鏈 16 處補齊；getAdapter 改 switch 修掉 adobe 誤導向 Canva）。
- Figma scope 改 env `FIGMA_SCOPES` 可覆寫。**Invalid scopes for app 根因＝Figma app 後台沒勾 `files:read`**。
- 修真 bug：widget picker 沒依 flag 過濾 → flag 關的 widget 仍可加、加了 404（假關閉）→ 依 getFlags 過濾。

### 天氣城市 autocomplete（`a4ae430`）
- 改 Open-Meteo 地理編碼即時搜尋（縣市/區/外島＋外國城市、在地化名），取代寫死清單、順便解 i18n 疑慮。保留自由輸入與定位。

### 多帳號連接（`ae9f079`）
- Canva/Figma/Adobe 每 provider 可綁多帳號（schema 本就有 external_account_id + unique、免 migration）。
- callback 抓帳號身分（Canva /users/me+profile、Figma /v1/me）→ 依帳號 upsert（同帳號更新／舊 NULL 就地升級／新帳號新增），設定頁每帳號一張卡＋「連接另一個帳號」。
- （Luffy 實測 Canva 連接成功、能抓作品 → connect+sync 整條路真的通。）

### 後台使用者上線資訊 + user_sessions（`bba97d5`）
- 新表 `user_sessions`（migration 0059、**已套 hosted**、型別手補 generated 對齊；Docker 沒開故 CLI 沒法自動重生，之後本機補跑一次正式對齊）。站台級、RLS 管理員可讀、service-role 寫。
- **隱私**：只存 ip_hash + 地區字串、**絕不存原始 IP**。heartbeat（登入限定、zod）首次才查 geo/device、時長 clamp[0,300]。
- geo：邊緣 header 優先 → 外部 fallback（ipapi.co/ip-api.com/ipwho.is、各 3s、24h 快取）——**經 Luffy 明確選用外部 IP→地區**，隱私政策已誠實揭露、第三方清單已列。
- 後台清單「在線」badge、詳情頁「上線資訊」+近 5 session。
- **安全註**：系統對 geo 外呼示警（送 IP 給第三方）——已逐檔審確認只送 IP、不存原始 IP、邊緣優先/首次才查/快取/登入限定/已揭露，屬 Luffy 授權範圍，非越界外洩。

### 天氣動畫換 jochang Lottie（`weather-lottie`）
- **症狀**：天氣圖示「不會動」。用瀏覽器自動化實測診斷——`document.hidden=true`（背景分頁 rAF 暫停）會讓所有 Lottie 凍住，故我在自動化分頁截到的「凍住」不算數；改查**資料本身**才是真因。
- **根因**：原 Meteocons「fill」的晴天/多雲**動得太細微**（晴天只有太陽 0°→45° 單一旋轉、1 個動畫屬性；多雲雲朵原地微浮，起訖同座標）→ 視覺上像沒動。雨/雪/雷/霧本來就會動。**不是程式凍住、也不是 lottie_light 缺 expression**（原檔本就無 expression）。
- **修法**：照 Luffy 指定，改用 LottieFiles **jochang** 天氣整套（Lottie Simple License，免費可商用）。瀏覽器自動化查證授權+資訊面板，Luffy 登入後手動下載 13 個 JSON，我收檔整合。
- **上線前客觀驗證**（無法靠截圖看動→改量資料）：13 檔皆 Lottie v5.1.1／60fps／180 幀（3 秒循環）；keyframe 密度全面提升（雨/驟雨/暴雨 110–140、雪 44、晴天 15＞原 3）；**expr=0**（lottie_light 播得動）、**無外部圖片資產**（離線可打包）。
- 新增 `rain-day`/`rain-night`（jochang 有日夜兩版，比原本單一 rain 更貼合）；`weatherIconName` rain 分日夜。`LICENSE.md` 換成 jochang/LottieFiles 標註+檔案對應表。typecheck/lint 綠。
- **後續修（換 jochang 後仍回報「沒動」）**：程式面已驗（jochang 無 expression、autoplay+loop、keyframe 充足），唯一會凍住合法動畫的路徑＝`WeatherLottie` 的 reduced-motion/saveData gate → `goToAndStop(0)`。**判斷**：使用者系統很可能關了動畫效果（prefers-reduced-motion）→ 我們把天氣小圖也一起靜止了。**修法**：天氣圖示（小、opt-in、功能性）改成**一律 autoplay+loop**，不套背景那種減動態靜止（大面積背景動畫仍尊重）。無法自己開瀏覽器實測（擴充一直斷），故以程式推理定因；若部署+硬重整後仍靜止，則屬部署未更新/播放器問題、需再實測。

### Milestone F — S5 mock harness（子代理寫、主對話審）
- **背景**：S5＝以「錄製的真實回應」建 provider mock，規格**禁手寫理想化 mock**；真 fixtures 卡首次實跑。故先把**周邊 harness** 全建好，實跑一錄即完成。
- **做了什麼**：`provider-core` 抽出可注入 HTTP seam `ProviderHttpGet`（三個 adapter 方法統一走 `this.http`）；`record.ts`（`DESIGN_SYNC_RECORD_DIR` gate、去敏後寫 `recorded/<provider>/<endpoint>.json`）；`replay.ts`（重播真 adapter，缺 fixture 拋 `MissingRecordedFixtureError` **不回假資料**）；`s5-replay.test.ts`（fixtures 缺席→`it.skip` 附原因、**非假通過**）；`__fixtures__/README.md`。
- **主對話審**（一個寫一個驗）：確認 ①`resolveDefaultHttpGet` 未設 env → 回原 `realProviderHttpGet`、**零行為改變**；②redaction 命中 token/email/帶簽章 URL、且文件標明仍需人眼複查；③replay 缺檔拋錯非靜默；④`provider-core` 只被 route handler／server component 引用（非 client／edge）→ 新增的 `node:fs` 靜態 import 安全；⑤四閘門綠（lint/typecheck/deps/vitest：71 pass、2 skip）。
- **仍待**：真實 fixtures（首次端到端實跑用 `DESIGN_SYNC_RECORD_DIR` 錄）。

### #55 背景商店 Slice 2 — 程序化場景擴充（子代理寫、主對話審）
- `scenes.ts` 追加 **36 個新程序化場景**（天氣8／星空8／自然8／慶祝6／簡約6），皆資料驅動、背景商店依 `scenesByCategory` 自動分類顯示，未動 UI/型別/helper。
- 新增 4 個底色常數（DAWN 曦光、TWILIGHT 暮色、MEADOW 草綠、DEEPSEA 深海），沿用既有 const 風格、各至少 1 場景使用。
- 審：無重複 id（全 ~106 場景）、配色/密度/速度與既有明顯區隔、typecheck/lint 綠。

### #55 背景商店 — 場景擴充到每類 50（300）+ 新類「城市夜景」（子代理寫、主對話審）
- 依 Luffy 指示把 5 現有類**各補滿到 50** + 新增第 6 個程序化類 **城市夜景**（霓虹燈點/窗光/霓虹雨/街燈飄升/招牌星，10 個城市夜色底色常數）→ **6 類 × 50 = 300 個程序化場景**（+193）。
- 新增 `SceneCategory '城市夜景'` + `SCENE_CATEGORIES`；全 repo 無 SceneCategory 窮舉 switch/map 需擴（背景商店 tab 資料驅動、自動長出新類）。
- 審（獨立重跑）：category 計數各 50、**無重複 id（全 300）**、無畸形 hex/rgb、`SceneCategory` union 正確、typecheck/lint + `scenes.test.ts` 6/6 綠。
- **第 7 類「動漫」＝插畫/Lottie**（Luffy 選的形式，非程序化）：走之後的免費商用 sourcing（+50）→ 共 350。
- **仍待（#55）**：免費可商用 Lottie 背景 + 動漫插畫/Lottie（皆需 LottieFiles 下載流程 + 我逐一看構圖/keyframe 密度挑「真的好看」的）。

### 裝飾品 widget（子代理寫、主對話審 + 我套 migration）
- **素材**：81 個可愛 Fluent Emoji（Microsoft，MIT）Color SVG 抓進 `public/decorations/`，`lib/decorations/manifest.json`（繁中標籤、6 類：動物/植物/甜點/天空/愛心/可愛）+ `LICENSE.md`。curl 直抓 raw.githubusercontent（Sentence-case 資料夾/snake 檔名），81/81 全中。
- **資料**：migration `0060_space_decorations`（x/y 存視窗比例 0..1、scale/rotation/opacity/tint jsonb/z_index；RLS `is_space_member` 抄 background_items；`touch_updated_at` trigger）。**已套 hosted**（dry-run 確認僅 0060 pending → apply OK）。型別手補 generated（Docker 沒開）。
- **API**：`/api/decorations` GET/POST（zod、`isDecorationId` 白名單、x/y 夾 0..1、每 space 上限 80）、`/[id]` PATCH/DELETE。**space_id 一律取自 session（resolveContext），非 client header**；全走 getDb 受 RLS。
- **overlay**：`DecorationLayer` 掛在 `(space)/layout.tsx`（FloatingAgent 同層）。**檢視模式整層與每張圖 pointer-events:none，永遠不擋點擊**；`?decorate=1` 進編輯：可拖曳（pointer capture + 防抖 PATCH、放開即落地）、選取後控制面板（大小/旋轉/透明度拉桿 + 漸層 tint 兩色停+角度、可清除回原色）、＋加入裝飾挑選器（81 個分類）、複製/刪除、完成離開。染色＝mask-image 剪影填漸層；透明度一律套用。
- **審**：pointer-events 檢視零攔截、API session 綁定、picker/panel/toolbar 皆 pointer-events:auto + `max-width:calc(100vw-24px)`+flex-wrap 手機安全、tint span 56×56、touch_updated_at 存在、五閘門綠（typecheck/lint/deps/secrets/**rls 60 表含 space_decorations**）。
- **無 flag**（沒擺就不顯示、天生 opt-in）。入口：背景頁加「開始擺放裝飾」連到 `/home?decorate=1`。
- **對齊格線（Luffy 0729 回饋）**：編輯工具列加「對齊格線」開關（預設關＝維持自由擺放）；開啟後顯示參考格、拖曳/新增皆吸附到格點；**格子大小可調**（拉桿改視窗等分數，格線與吸附即時跟著變）。純前端（DecorationLayer + globals.css），無 API/DB 變動；工具列 flex-wrap + max-width 手機安全。

## 待你(Luffy)
- **後台開 flag `weatherWidget`** → 天氣才會出現(現在 def 與 flag row 都在、但 flag=off)。開了到「設定→天氣」勾選+填城市 → 首頁加天氣 widget。
- **F 第一次端到端實跑**：連 Canva/Figma → 選檔(S4 picker) → 同步 → 看 `design_snapshots` 出版本。這一步順便**錄真實回應**供 S5 mock、校正 Figma/Canva 端點。
- 這批 4 commit 已 push(RWD `bc76a2a`／F `cd3fe3a`／天氣 `0b907e3`／docs)，Zeabur 會自動部署；記得**點進網站確認 CSS 有載入**(build 綠≠起得來)。
- 其餘照舊：JWT secret 換 demo、Q10 手動走查、台北黑體字檔。
- 內容補量 #50(問候/micro/seasonal/welcome → 4000)還沒動,需調高子代理配額重開 session。

### 下半場相關（Luffy）
- **Figma 連接「Invalid scopes for app」**：到 Figma app 後台 OAuth 勾 **`files:read`** scope（程式送的 scope 是對的、問題在 app 沒開）。必要時 Zeabur 設 `FIGMA_SCOPES` env 覆寫。
- **天氣「讀取失敗」**：程式/端點/flag 都驗過沒問題 → 多半是部署還在跑 or 60s flag 快取，等部署+`Ctrl+Shift+R`。還不行就給我 `/api/weather` 的 Network 狀態碼。
- **後台上線資訊**：部署後到 `/admin/users` 看有沒有「在線」badge、點進使用者看地區/裝置/時長有沒有正確（第一筆真實 session 驗證）。
- **型別重生**：本機開 Docker 後跑一次 `pnpm exec supabase gen types typescript --local > packages/shared-types/src/database.generated.ts` 正式對齊 user_sessions（現在是手補、typecheck 已綠）。
- 下半場 commit：作品AI `fc2617d`／Adobe+Figma+picker `2734bdd`／天氣搜尋 `a4ae430`／多帳號 `ae9f079`／後台上線 `bba97d5`（+docs）。
