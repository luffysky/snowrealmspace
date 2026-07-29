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
- **後續修（換 jochang 後仍回報「沒動」）— 兩步定因**：
  1. 先猜 reduced-motion gate（`WeatherLottie` 唯一會凍住合法動畫的路徑）→ 改天氣圖示**一律 autoplay+loop**（`4d0cdca`）。但 Luffy 回報**動畫效果是開的**（RM=false）→ 這不是主因（RM 關時本來就 autoplay），**猜錯**。
  2. **改用實測**：瀏覽器自動化進線上站確認 jochang 部署已生效、SVG 有建（48px 容器、10 群組），但我的自動化視窗在背景（`hidden=true`、rAF 暫停）看不到動。**請 Luffy 在自己可見分頁貼一行 console 量** → 回傳 `{found:true, animating:true, hidden:false, reduce:false}`。
  3. **真因**：它**其實一直有在播**（transform 每秒都在變），只是 **48px 太小、當前多雲/晴這類本來就溫和的圖示**動態難以察覺（Meteocons、jochang 兩套都中同一點）。**修法**：天氣圖示 **48→72px** + `anim.setSpeed(1.4)` 讓動態明顯。**教訓**：破版/動畫「看起來不對」先**量**（照 CLAUDE.md #9），別連續送猜測；擴充連不上時請使用者貼 console 量，比我盲猜可靠。
  4. **放大雲的位移（Luffy：雲要左右來回、每片不同速度/幅度、都大一點）**：查 jochang 各雲層原本只左右擺 2~4px（256 viewBox）→ 幾乎看不到。寫腳本把**所有 `cloud` 圖層**的位移改寫成**無縫左右來回振盪**：每片雲不同幅度（16~30）、不同速度（1~2 循環/3s）、不同相位，clamp 在畫布內。11 個含雲圖示全改（晴天日/夜無雲）。純資料改、13 檔皆過 JSON 驗證。無法自看動畫→數值上驗證幅度已放大（多雲三片雲 swing 30/16.8/19.2）。
  5. **放大太陽光暈 + 月亮 + 星星（Luffy 續）**：查得太陽是同心圓環（轉動看不出來），原本只 3% scale 脈動；月亮/星星多半**全靜止**。改寫 sun/oval/moon/star 圖層的 scale 為**無縫呼吸脈動**：太陽光暈幅度 14%（3 環錯相位→100→86~116）、月亮 10%、星星 30% 且較快（閃爍、錯相位）。clear-night 原本只有靜止月亮 → 現在月亮脈動+星星閃爍，夜景活起來。8 檔改，全過驗證。
  6. **圖示後面的半透明「天空」背景（Luffy：日出日落暖光/大片烏雲/星空）**：不動 Lottie（風險高），改在 `WeatherLottie` 圖示後加**純 CSS 半透明背景**、依情境切換：晴天日＝暖色日出/日落光暈+天空藍；夜晚＝星空（深藍暈+幾顆會閃的星）；雨/雷/毛毛雨/颱風＝大片烏雲（數塊灰雲團疊合）；其餘＝淡淡柔光。顏色屬天氣美術（非 UI chrome），星星閃爍套 `prefers-reduced-motion:no-preference`。typecheck/lint 綠。
  7. **圖示/溫度隨 widget 放大（Luffy）**：天氣卡加 `container-type:inline-size`，圖示 `size` 型別放寬成可吃 CSS 長度，改用 **cqi 容器查詢單位**（icon `clamp(56px,34cqi,148px)`、溫度 `clamp(1.6rem,18cqi,4rem)`）→ widget 拉越大、圖示與溫度等比變大，零 JS。

### 時間日期 widget（新 widget，子代理寫、主對話審）
- 新增獨立 `datetime`「時間日期」widget：即時走針時鐘 + 可**勾選**的日期行（西元年月日／星期／**民國**／**農曆**），時間 4 種樣式（24/12 時 × 含不含秒），裝置本地時區＝當地時間。
- **農曆/民國全走瀏覽器 `Intl`**（`ca-chinese`／`ca-roc`）**免函式庫、不連網、不取位置**（permissions:[]）。**無 feature flag**（立即可加）。
- 註冊：`WIDGET_IDS`+`WIDGET_REGISTRY`+`config-fields` 的 `labelFor`（6 個中文標籤）+`COMPONENTS` lazy import。設定面板由 configSchema 自動生成（bool→勾選、enum→下拉）。
- **SSR/hydration**：`now` 初始 null、只在 client tick 才有值→首幀占位一致，不會 mismatch。
- **主對話補**：農曆日改**傳統寫法**（Intl 只給阿拉伯數字→自建初一…三十對應，`formatToParts` 取月/日；月份仍用 Intl 含閏月）→「農曆六月十六」。
- 審：`Intl` 各行 try/catch 缺曆別優雅略過、都沒勾誠實提示、tabular-nums 時鐘不抖、min-width:0/overflow-wrap 不溢格、token 配色；**已跑 `sync-widget-defs` 建 hosted `widget_definitions` row（15 widget）**；typecheck/lint/deps + registry 29 測綠。

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
- **跟著捲動 + 釘選 + 說明（Luffy 0729：裝飾沒跟畫面上下捲）**（子代理寫、主對話審）：查清整站 shell 是 `100dvh overflow:hidden`、真正在捲的是 `.sr-content`。改成**兩套座標系**（值域都 0..1、差在參考誰）：**未釘選（預設）**＝相對 `.sr-content`、`createPortal` 進去、`top=y*scrollHeight`px → **跟著頁面內容上下捲動**；**釘選**＝相對視窗 `fixed` → 固定畫面不捲。每個裝飾控制面板加「釘選/取消釘選」，切換時換算螢幕位置→原地不跳。migration `0061` 加 `pinned`（**已套 hosted**）、型別手補、API POST/PATCH 收 `pinned`。編輯加「說明」面板。**審**：pinned/portal 兩路檢視都 `pointer-events:none` 不擋點擊、`.sr-content` 設 `position:relative`、scrollHeight 用 ResizeObserver 追、五閘門綠；**我補修**子代理漏掉的拖曳「抓取偏移」（原本會跳到指標中心 → 改回抓哪拖哪，兩座標系都算偏移）。

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

### 每個 widget 可設背景（從場景庫，子代理寫、主對話審＋補開關/滑桿）
- 每個 widget 的設定面板加「背景」：分類籤 + 場景 swatch（用 `scene.base` 漸層當靜態預覽）+「無背景」。存 `config.bg`（自由 jsonb 鍵，免 schema/migration；PATCH 用 `z.record(z.unknown())`）。
- `WidgetRenderer` 讀 `config.bg` 且經 `getScene` 白名單驗證才渲染；卡片後 `ProceduralScene` + 卡片改 `color-mix` 半透明 + `backdrop-filter` 保持可讀（沿用 `--sr-surface`/`--sr-radius` token）。
- **主對話補**：`bgAnimate` 開關（**預設 false＝靜態**，傳 `paused` 給場景）+ `bgOpacity` 透明度滑桿（0.05~1，套在場景層）；並修 `data-glass=off` 特異度贏過問題讓場景照樣透出。五閘門綠。

### Widget 大擴充 Wave 1（5 個 + 日期欄位 + 分類清單，子代理寫、主對話審）
- 新增 5 個 widget：**紀念日**(D+N，date-only 算天、避 UTC 陷阱、DST round)、**倒數計時**(可含時分)、**迷你月曆**(今日高亮、可農曆)、**世界時鐘**(4 時區、Intl timeZone)、**每日情話**(依日決定、可自訂句庫)。皆 SSR-safe(now/today null→client tick)、config-jsonb 存、無 flag。
- 新增 **`date` config 欄位型別**(key 為 sinceDate/targetDate/…Date → `<input type="date">`)；`phrases` 用 textarea。
- **加入區塊清單依 `category` 分組**(每日/個人/創作/專案/工具/系統/Agent 中文標題)；新增 `personal` 分類。
- 審：AnniversaryWidget date-only+DST 正確、Intl 各處 try/catch、行動安全；已跑 `sync-widget-defs` 建 hosted 定義；typecheck/lint/deps + registry/config-fields 29 測綠。

### Widget 大擴充 Wave 2（6 個，子代理寫、主對話審）
- 新增 6 個 widget：**待辦清單**(in-widget 增/勾/刪)、**習慣追蹤**(35 天格+連續天數)、**相框**(接媒體庫 signed URL+4 種框)、**呼吸練習**(呼吸圈+階段)、**骰子決定器**、**幸運籤**。分類新增 `fun`/`relax`（0062 已允許）。
- **狀態寫回**：待辦/習慣在 widget 內編輯 → 樂觀更新 + 防抖 PATCH 自己的 config，**`{...config, items}` 合併**保住背景等鍵（審過）。錯誤有紅字提示不靜默。
- **相框**：設定面板加 `AssetPicker`（只在 photo_frame 顯示，列 `/api/assets?kind=image`、縮圖走 signed URL）；`assetId` 設為 unsupported 讓 picker 當唯一入口。
- **呼吸/骰子**：`prefers-reduced-motion` 尊重（減動態時不縮放、只換文字）。
- 加入清單分類補 `fun:娛樂`/`relax:放鬆` 標題。已 `sync-widget-defs`（hosted 現 26 widget）。typecheck/lint/deps + 29 測綠。

### 每個 widget 的「⚙ 設定」gear + 彈窗（Luffy：設定按鈕在 widget 直接點）（子代理寫、主對話審）
- 每個 widget（編輯模式）左上角加 **⚙ 設定** gear；點了開**浮動彈窗**（WidgetSettings）。gear 放左上（右上/右下已被拖曳/縮放把手佔用），`pointerdown` preventDefault+stopPropagation、z-index 高於把手 → 不會誤觸拖曳。
- 設定改成**彈窗 modal**（backdrop 點擊 / Esc / ✕ 關閉；`width:min(440px,100vw-24px)`、`max-height:85vh` 可捲、手機安全），取代原本底部清單的 inline 展開。
- 底部「區塊設定」清單保留（隱藏的 widget 沒有格上 gear，清單是它們唯一入口），「設定」鈕改成開同一彈窗。typecheck/lint 綠。

### Wave 3a：指針時鐘 + 花色 + 天氣動畫速度滑桿（子代理寫、主對話審）
- **時間日期 widget** 加 `clockKind`（電子/指針）+ `clockSkin`（經典/簡約/霓虹/粉彩/羅馬）。指針＝100×100 viewBox SVG（隨卡片等比、maxWidth 封頂）；針角度 秒×6°、分×6°+秒×0.1、時×30°+分×0.5；秒針不加 transition（避 59→0 回捲）逐秒 setState；reduced-motion 只去時/分針過渡。霓虹/粉彩用美術常數自帶深/淺底、明暗都可讀（scoped eslint-disable，比照 theme-defaults）。
- **天氣動畫速度**：`weatherConfig.animSpeed`（0.3~3、預設 1.4）→ `WeatherLottie` `setSpeed(animSpeed)`；`WeatherWidget` 傳入。
- **number 欄位改滑桿**：`FieldControl` number 只要有 min+max 就渲染 `<input type=range>`+即時數值；animSpeed 因此是「動畫速度」滑桿。labels 補 clockKind/clockSkin/animSpeed。typecheck/lint + 29 測綠。
