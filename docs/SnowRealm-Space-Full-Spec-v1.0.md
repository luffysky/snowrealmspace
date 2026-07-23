# SnowRealm Space v1.0 完整產品與技術規格書

> ## ⚠️ 實作前請先讀 `docs/spec/00-README.md`
>
> 本文件是**產品憲章**，回答「為什麼」與「要做什麼」。
> 實作細節（完整 SQL、RLS、API schema、Agent tool、驗收條件）在 `docs/spec/`。
> **兩者衝突時以 `docs/spec/` 為準。**
>
> 已被取代的章節：§12.2、§34.1（`backgrounds` / `asset_versions`）、§34.5、§34.7 的 `owner_id`、§35、§39.1、§54、§57。
> 對照表見 `docs/spec/00-README.md`。
>
> **§57「尚待決策事項」的 20 項已全數收斂**，見 `docs/spec/01-decisions.md`。
> 已拍板：無硬期限（Milestone 閉環優先）／Next.js + Supabase + R2／Magic link + 多租戶 RLS／
> 多模型 AI 免費優先（移植自 `AI/ai_island_v3`）。

> **專案代號：** Nami Space  
> **正式產品家族：** SnowRealm Space  
> **文件狀態：** Product Charter（實作層見 `docs/spec/`）  
> **文件用途：** 產品願景、範圍與原則的真相來源  
> **初始版本：** Birthday Alpha  
> **長期定位：** AI Personal Space / Living Digital Habitat / Creative Life OS  
> **最後更新：** 2026-07-23  

---

# 目錄

1. 文件目的  
2. 產品摘要  
3. 產品定位  
4. 核心問題  
5. 產品原則  
6. 目標使用者  
7. 核心使用情境  
8. 核心循環與產品飛輪  
9. 整體資訊架構  
10. Home Space  
11. Theme Studio  
12. Background Studio  
13. Font System  
14. Widget System  
15. Design Hub  
16. Creative Library  
17. Figma 整合  
18. Canva 整合  
19. Adobe 整合  
20. 通用設計軟體整合層  
21. AI Agent  
22. Memory System  
23. Insight Engine  
24. Daily System  
25. Surprise Engine  
26. Timeline  
27. Project System  
28. Notification System  
29. Search System  
30. Onboarding  
31. 使用者設定  
32. 隱私與安全  
33. 系統架構  
34. 資料庫設計  
35. API 規格  
36. 事件系統  
37. 背景任務與 Queue  
38. 檔案儲存  
39. AI 架構  
40. Prompt 管理  
41. 權限模型  
42. 效能要求  
43. 無障礙要求  
44. 分析與指標  
45. 測試策略  
46. 錯誤處理  
47. Feature Flag  
48. Birthday Alpha 範圍  
49. V1 範圍  
50. V2 範圍  
51. V3 長期方向  
52. 開發里程碑  
53. Repository 建議結構  
54. Claude Code 執行規範  
55. Definition of Done  
56. 已知風險  
57. 尚待決策事項  

---

# 1. 文件目的

本文件定義 SnowRealm Space 的產品願景、功能範圍、系統架構、資料模型、整合策略、Agent 行為、隱私規範、版本分期與工程落地要求。

本文件不是概念提案，也不是行銷頁草稿。

本文件的主要讀者包括：

- 產品負責人
- 前端工程師
- 後端工程師
- AI 工程師
- UX/UI 設計師
- Claude Code
- Codex CLI
- 未來加入 SnowRealm 的協作者

本文件必須讓開發者在閱讀後可以回答：

1. 產品到底要解決什麼問題。
2. 使用者每天為什麼會回來。
3. 哪些功能屬於 Birthday Alpha。
4. 哪些功能不能假裝已經完成。
5. 各模組如何交換資料。
6. 哪些資料屬於敏感資料。
7. Agent 可以做什麼，不能做什麼。
8. Figma、Canva、Adobe 要怎麼分階段整合。
9. 主題、背景、字體與 Widget 如何共用同一套底層。
10. 如何避免專案變成失控的功能拼盤。

---

# 2. 產品摘要

SnowRealm Space 是一個會隨使用者長期使用而成長的私人數位空間。

它結合：

- 自訂首頁
- 主題編輯器
- 背景與幻燈片
- 字體搭配
- 可拖曳 Widget
- AI Agent
- 長期記憶
- 創作作品庫
- 設計軟體整合
- 每日內容
- 使用歷程
- 作品分析
- 個人化洞察
- 時間軸
- 未來擴充的 Plugin 架構

它不是單純聊天機器人。

它不是一般 Dashboard。

它不是純作品集。

它不是 Notion 換皮。

它是一個：

> **會越來越像主人的數位棲地。**

初始版本會以 Nami Space 的形式作為生日禮物與首位真實使用者測試。

底層架構必須從一開始就支援未來多使用者版本，而不是把 Nami 的名稱、偏好與資料寫死在程式中。

---

# 3. 產品定位

## 3.1 一句話定位

> SnowRealm Space 是一個能被使用者親手布置、由 AI 協助理解與整理，並且會隨創作、記憶與日常活動持續成長的私人數位空間。

## 3.2 核心價值

SnowRealm Space 必須同時提供四種價值：

### 身分價值

使用者可以用：

- 背景
- 顏色
- 字體
- 卡片
- 動畫
- Widget
- Agent 外觀
- 作品展示

塑造一個真正屬於自己的空間。

### 實用價值

使用者可以：

- 管理創作
- 查看專案
- 取得 AI 建議
- 整理靈感
- 比較設計版本
- 建立主題
- 記錄重要內容

### 累積價值

使用時間越長，系統會累積：

- 設計作品
- 主題
- 背景
- 使用偏好
- Agent 記憶
- 專案歷程
- 每日卡片
- 洞察
- 時間軸

### 期待價值

每次回來可能看到：

- 新的每日卡片
- Agent 主動訊息
- 稀有驚喜
- 世界變化
- 新洞察
- 背景切換
- 未完成專案提醒
- 歷史回顧
- 作品同步結果

---

# 4. 核心問題

SnowRealm Space 必須解決以下問題：

## 4.1 傳統 AI Agent 缺乏持續性

多數 Agent 的互動模式是：

1. 使用者問問題。
2. Agent 回答。
3. 對話結束。
4. 隔天沒有新的理由回來。

SnowRealm Space 必須讓 Agent 成為空間的一部分，而不是唯一入口。

## 4.2 創作者的資料分散

創作者的內容通常散落在：

- Figma
- Canva
- Adobe
- 手機相簿
- Google Drive
- 本機資料夾
- 社群平台
- 聊天紀錄
- 筆記工具

SnowRealm Space 必須提供一個統一入口，但不能假裝自己能取代所有軟體。

## 4.3 個人化常停留在換色

多數產品的個人化只包含：

- 深色模式
- 淺色模式
- 幾個預設色

SnowRealm Space 的個人化必須包含：

- 完整色彩系統
- 字體
- 背景
- 幻燈片
- 卡片材質
- 動畫
- Widget 配置
- Agent 呈現
- 自己的作品

## 4.4 AI 常做沒有證據的推測

產品不能對使用者說：

- 妳最近很焦慮。
- 妳的設計變成熟了。
- 妳今天心情不好。
- 妳最喜歡某個風格。

除非存在可驗證資料。

系統必須分清楚：

- 事實
- 數據
- 推測
- 建議
- 創意內容

---

# 5. 產品原則

## 5.1 使用者控制

使用者必須控制：

- 是否連接外部服務
- 同步哪些檔案
- 是否允許分析
- 是否儲存記憶
- 是否接收主動訊息
- 是否收集使用行為
- 是否保留歷史版本
- 是否公開作品
- 是否允許 Agent 執行動作

## 5.2 證據優先

任何分析結果至少要保留一項證據來源：

- 設計快照
- 顏色統計
- 使用事件
- 專案變更
- 使用者明確陳述
- 版本差異
- 行為統計

## 5.3 一至三分鐘即可獲得價值

首頁不可逼迫使用者先完成複雜流程。

使用者應在三分鐘內完成至少一件有價值的事：

- 看每日卡片
- 打開驚喜
- 換背景
- 套用主題
- 問 Agent
- 上傳作品
- 繼續專案

## 5.4 漸進式揭露

初次登入不可同時展示全部模組。

功能應依照以下條件逐步出現：

- 已完成 onboarding
- 已上傳第一個作品
- 已建立第一套主題
- 已連接第一個 Provider
- 已使用 Agent
- 已累積足夠事件
- 已達成里程碑

## 5.5 不做情緒操控

禁止：

- 連續登入中斷羞辱
- 假稀缺
- 假倒數
- 情緒勒索通知
- 誇大 Agent 感情
- 聲稱 Agent 離不開使用者
- 故意製造焦慮

## 5.6 功能必須形成閉環

任何功能都必須回答：

1. 使用者為何使用。
2. 使用後產生什麼結果。
3. 結果如何改變下一次體驗。
4. 是否增加個人化。
5. 是否能被刪除或撤銷。

---

# 6. 目標使用者

## 6.1 首位使用者

Nami 是 Birthday Alpha 的首位真實使用者。

已知偏好可用於初始設定，但不可寫死於平台底層：

- 喜歡粉色
- 對設計與創作有興趣
- 可能使用 Figma、Canva、Adobe 類工具
- 喜歡視覺上可愛、柔和、可自訂的介面

## 6.2 未來主要使用者

### 創作者

- 設計師
- 剪輯者
- 插畫創作者
- 影片創作者
- 社群內容創作者
- 音樂創作者
- 自媒體經營者

### 學習者

- 正在學設計
- 正在學 AI
- 正在學程式
- 需要個人學習空間

### 一般個人使用者

- 喜歡布置數位空間
- 想要 AI 陪伴與整理
- 想保存日常與回憶
- 想建立個人數位世界

---

# 7. 核心使用情境

## 7.1 每日回訪

使用者打開 Space 後看到：

- 今天背景
- Agent 今日訊息
- 每日卡片
- 驚喜
- 最近作品
- 空間變化
- 未完成專案

## 7.2 自訂個人空間

使用者可以：

- 上傳圖片
- 建立背景幻燈片
- 設定輪播速度
- 選擇轉場
- 自訂顏色
- 選擇字體
- 調整毛玻璃
- 拖曳 Widget
- 儲存多套版面

## 7.3 從作品建立主題

使用者選擇一張設計：

1. 系統抽取色彩。
2. 系統辨識構圖與視覺風格。
3. 系統建議字體。
4. 系統產生主題草稿。
5. 使用者預覽。
6. 使用者修改。
7. 套用到 Home Space。

## 7.4 作品分析

使用者選擇某個設計快照。

Agent 必須：

- 只分析被選取的內容
- 顯示可驗證觀察
- 清楚區分建議
- 不假裝知道設計目的
- 允許使用者補充目的
- 保存分析結果

## 7.5 長期陪伴

使用者與 Agent 互動後：

- 部分內容只存在對話
- 部分內容可被建議成記憶
- 使用者批准後才進入長期記憶
- 未來回覆可根據記憶提供更合適建議

---

# 8. 核心循環與產品飛輪

## 8.1 每日核心循環

```text
進入 Space
    ↓
看到今天發生的變化
    ↓
收到一個有價值的內容
    ↓
完成一個小行動
    ↓
空間或資料產生變化
    ↓
系統保留有用上下文
    ↓
下次回來更符合使用者
```

## 8.2 創作循環

```text
匯入或建立作品
    ↓
建立快照
    ↓
取得分析或建議
    ↓
修改作品
    ↓
同步新版
    ↓
比較差異
    ↓
形成創作歷程
```

## 8.3 個人化循環

```text
上傳背景或作品
    ↓
抽取配色
    ↓
建立主題
    ↓
套用主題
    ↓
調整 Widget
    ↓
儲存偏好
    ↓
未來推薦更準
```

## 8.4 長期產品飛輪

```text
使用空間
    ↓
投入內容與設定
    ↓
系統累積資料
    ↓
Agent 與推薦更貼近
    ↓
空間更像使用者
    ↓
使用者更願意投入
    ↓
內容、記憶與情感價值增加
```

---

# 9. 整體資訊架構

## 9.1 Desktop 主導覽

- Home
- Design Hub
- Studio
- Library
- Timeline
- Agent
- Settings

## 9.2 Mobile 主導覽

- Home
- Design
- Create
- Agent
- More

## 9.3 模組結構

```text
SnowRealm Space
├── Home Space
├── Theme Studio
├── Background Studio
├── Font System
├── Widget System
├── Design Hub
├── Creative Library
├── Project System
├── AI Agent
├── Memory System
├── Insight Engine
├── Daily System
├── Surprise Engine
├── Timeline
├── Search
├── Integrations
├── Notifications
├── Privacy Center
└── Developer / Plugin Layer
```

---

# 10. Home Space

## 10.1 目的

Home Space 是每天回訪的主畫面。

它必須快速回答：

- 今天有什麼新內容。
- 我最近在做什麼。
- Agent 有什麼想說。
- 空間今天有什麼變化。
- 我接下來能做什麼。

## 10.2 預設區塊

- Today Header
- Agent Presence
- Daily Card
- Surprise Box
- Current Project
- Recent Designs
- Quick Note
- Theme Switcher
- Background Control
- Timeline Preview

## 10.3 Today Header

顯示：

- 日期
- 問候
- 當前主題
- 今日事件
- 今日一句
- 可選擇顯示目前時間
- 可選擇顯示天氣

天氣功能只有在使用者明確允許定位或設定城市時啟用。

## 10.4 Agent Presence

Agent 呈現形式：

- 浮動頭像
- 桌面角色
- 對話泡泡
- 側邊欄
- 小型卡片

可設定：

- 顯示或隱藏
- 大小
- 位置
- 動畫
- 主動訊息頻率
- 是否顯示表情
- 是否播放音效
- 是否進入 Quiet Mode

## 10.5 Home Layout

採用格線配置。

建議：

- Desktop：12 欄
- Tablet：8 欄
- Mobile：單欄排序

使用者可：

- 拖曳
- 調整大小
- 隱藏
- 釘選
- 重設
- 儲存 Layout Preset
- 切換 Layout Preset

---

# 11. Theme Studio

## 11.1 目的

Theme Studio 讓使用者自行組合完整視覺主題。

主題不只是一個顏色。

主題包含：

- 顏色
- 字體
- 背景
- 卡片材質
- 邊框
- 圓角
- 陰影
- 動畫
- Icon 風格
- 可選擇音效

## 11.2 ThemeDefinition

```ts
export type ThemeDefinition = {
  id: string;
  name: string;
  version: number;

  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    surfaceAlt: string;
    textPrimary: string;
    textSecondary: string;
    border: string;
    success: string;
    warning: string;
    danger: string;
  };

  typography: {
    headingFontId: string;
    bodyFontId: string;
    uiFontId: string;
    monoFontId?: string;
    headingScale: number;
    bodyScale: number;
    lineHeight: number;
    letterSpacing: number;
  };

  surfaces: {
    style: "solid" | "glass" | "soft" | "outline";
    opacity: number;
    blur: number;
    radius: number;
    borderWidth: number;
  };

  effects: {
    shadow: "none" | "soft" | "medium" | "dramatic";
    glow: boolean;
    noise: boolean;
  };

  motion: {
    preset: "none" | "soft" | "float" | "playful" | "cinematic";
    intensity: number;
    reduceMotionFallback: boolean;
  };

  backgroundPlaylistId?: string;
};
```

## 11.3 CSS Variables

所有 UI 元件必須使用 Token，不可寫死顏色。

```css
:root {
  --sr-primary: #f3a7c3;
  --sr-secondary: #ffdce8;
  --sr-accent: #8c5870;
  --sr-background: #fff7fb;
  --sr-surface: rgba(255,255,255,.58);
  --sr-surface-alt: rgba(255,255,255,.32);
  --sr-text-primary: #38252d;
  --sr-text-secondary: #725461;
  --sr-border: rgba(255,255,255,.42);
  --sr-radius: 24px;
  --sr-blur: 20px;
  --sr-heading-font: "Playfair Display";
  --sr-body-font: "Noto Sans TC";
}
```

## 11.4 必須功能

- 即時預覽
- 自訂主色
- 自訂輔色
- 自訂強調色
- 自訂文字色
- 自訂卡片色
- 自訂邊框
- 毛玻璃
- 實色卡片
- 陰影
- 圓角
- 字體選擇
- 字體配對
- 動畫強度
- 儲存
- 另存新檔
- 複製
- 刪除
- 匯出 JSON
- 匯入 JSON
- 還原預設

## 11.5 配色模式

### 手動配色

使用者自行選擇全部 Token。

### 圖片取色

從圖片抽取：

- dominant
- secondary
- accent
- dark contrast
- light contrast

### AI 配色

使用者輸入：

- 溫柔
- 成熟
- 夢幻
- 專注
- 夜間
- 復古
- 清爽
- 未來感

系統產生多組 Theme Draft。

### 無障礙配色

優先確保：

- 文字對比
- 按鈕辨識
- Focus Ring
- 錯誤訊息
- 成功訊息
- Disabled 狀態

## 11.6 Theme Version

每次儲存主題可建立版本。

支援：

- 查看歷史版本
- 還原
- 比較
- 命名
- 標記收藏

---

# 12. Background Studio

## 12.1 支援背景類型

- 圖片
- GIF
- 短影片
- 漸層
- 程式動畫
- 設計作品
- Figma 預覽
- Canva 匯出圖
- Adobe 匯出圖
- 自動每日背景

## 12.2 BackgroundItem

```ts
export type BackgroundItem = {
  id: string;
  type: "image" | "gif" | "video" | "gradient" | "procedural";

  sourceUrl?: string;
  thumbnailUrl?: string;

  fit: "cover" | "contain" | "original";

  positionX: number;
  positionY: number;
  zoom: number;

  blur: number;
  brightness: number;
  contrast: number;
  saturation: number;

  overlayColor: string;
  overlayOpacity: number;

  loop: boolean;
  muted: boolean;
};
```

## 12.3 幻燈片播放模式

- 依序
- 隨機
- 每次登入切換
- 每日切換
- 每小時切換
- 依時段
- 依星期
- 依專案
- 手動切換

## 12.4 Birthday Alpha 轉場

- Fade
- Blur Fade
- Zoom Fade

## 12.5 未來轉場

- Slide
- Dissolve
- Parallax
- Page Turn
- Cinematic Wipe
- Pixel Transition

## 12.6 效能要求

- 僅預載下一張
- 最多預載兩個項目
- 分頁不可見時停止影片
- 手機自動降低影片畫質
- 支援 Reduced Motion
- 大圖建立縮圖
- 影片需要轉碼
- 使用 CDN
- 不直接載入原始超大檔案

## 12.7 排程背景

可設定：

```text
06:00–11:00 清晨
11:00–17:00 白天
17:00–21:00 黃昏
21:00–06:00 夜晚
```

排程需以使用者時區計算。

---

# 13. Font System

## 13.1 目標

- 支援繁體中文
- 支援英文
- 可擴充日文與韓文
- 動態載入
- 保留授權資料
- 提供字體配對
- 避免首屏載入全部中文字體

## 13.2 FontRecord

```ts
export type FontRecord = {
  id: string;
  family: string;
  slug: string;
  category: "sans" | "serif" | "display" | "handwriting" | "mono";

  supportedLanguages: string[];
  weights: number[];
  styles: Array<"normal" | "italic">;

  previewText: string;
  fileManifest: Record<string, string>;

  licenseName: string;
  licenseUrl: string;
  attributionRequired: boolean;

  enabled: boolean;
};
```

## 13.3 初始字體數量

Birthday Alpha 建議 8 套。

分類：

- 2 套繁中黑體
- 2 套繁中明體或手寫體
- 2 套英文 Sans
- 1 套英文 Serif / Display
- 1 套 Monospace

最終清單必須逐套確認：

- 是否允許商用
- 是否允許網站嵌入
- 是否允許自行託管
- 是否允許轉換 WOFF2
- 是否需要署名
- 是否允許修改

## 13.4 載入策略

- Current UI Font 預載
- Heading Font 按需載入
- Body Font 按需載入
- 使用 WOFF2
- `font-display: swap`
- 優先使用子集
- 首屏不可載入全部中文字型
- 每個 Theme 只載入實際使用字體

## 13.5 Font Pair

```ts
export type FontPair = {
  id: string;
  name: string;
  headingFontId: string;
  bodyFontId: string;
  uiFontId: string;
  moodTags: string[];
};
```

---

# 14. Widget System

## 14.1 目標

Home Space 不應被寫死。

所有首頁功能應以 Widget 形式存在。

## 14.2 Birthday Alpha Widgets

- Daily Card
- Surprise Box
- Agent Message
- Current Project
- Recent Designs
- Quick Note
- Theme Switcher
- Background Control
- Timeline Preview

## 14.3 Future Widgets

- Calendar
- Focus Timer
- Music
- Weather
- Mood Check-In
- Inspiration Board
- Goal Tracker
- Recent Figma Changes
- Canva Export
- Creative Streak
- Shared Messages

## 14.4 WidgetDefinition

```ts
export type WidgetDefinition = {
  id: string;
  name: string;
  version: string;
  category: string;

  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
  maxSize: { w: number; h: number };

  configSchema: Record<string, unknown>;
  permissions: string[];
};
```

## 14.5 Widget Instance

```ts
export type WidgetInstance = {
  id: string;
  spaceId: string;
  widgetDefinitionId: string;

  x: number;
  y: number;
  w: number;
  h: number;

  config: Record<string, unknown>;
  hidden: boolean;
  locked: boolean;
};
```

## 14.6 錯誤隔離

單一 Widget 發生錯誤時：

- 不可拖垮整個 Home Space
- 顯示 fallback
- 可重新載入
- 保留位置
- 記錄錯誤
- 可停用

---

# 15. Design Hub

## 15.1 目的

Design Hub 是所有創作作品與外部設計軟體的統一入口。

功能包含：

- 上傳作品
- 建立專案
- 連接 Provider
- 瀏覽作品
- 建立快照
- 分析
- 比較
- 產生主題
- 設為背景
- 加入 Timeline

## 15.2 Birthday Alpha 支援

- PNG
- JPG
- WEBP
- GIF
- PDF
- 手動作品名稱
- 手動專案
- 預覽
- 主題生成
- 背景設定
- AI 分析

## 15.3 V1 支援

- Figma OAuth
- 選擇檔案
- 同步快照
- 讀取設計結構
- 版本比較
- 更新提醒

## 15.4 V2 支援

- Canva Connect
- Canva App
- Adobe Express Add-on
- Photoshop Plugin

## 15.5 DesignFile

```ts
export type DesignFile = {
  id: string;
  ownerId: string;
  provider: "upload" | "figma" | "canva" | "adobe" | "other";

  externalId?: string;
  title: string;
  description?: string;
  sourceUrl?: string;
  thumbnailUrl?: string;

  projectId?: string;
  tags: string[];

  syncStatus: "manual" | "active" | "paused" | "error";
  lastSyncedAt?: string;

  createdAt: string;
  updatedAt: string;
};
```

## 15.6 DesignSnapshot

```ts
export type DesignSnapshot = {
  id: string;
  designFileId: string;

  externalVersionId?: string;
  previewUrl: string;
  documentDataUrl?: string;

  extractedFeatures: Record<string, unknown>;
  checksum: string;

  createdAt: string;
};
```

## 15.7 可抽取特徵

- 主色
- 輔色
- 強調色
- 字體
- 字級
- 行距
- 文字密度
- 留白比例
- 圓角分布
- 陰影
- 元件數量
- 元件重複率
- 圖片數量
- 頁面數量
- Artboard 尺寸
- CTA 數量
- 對比問題
- 可讀性問題
- 版面層級
- 語言
- 風格標籤

## 15.8 版本比較

支援：

- 並排
- 疊圖
- 滑桿比較
- 色彩差異
- 文字差異
- 元件差異
- 排版差異
- Agent 摘要

---

# 16. Creative Library

## 16.1 儲存內容

- 圖片
- 設計
- PDF
- 影片
- 音訊
- Prompt
- 筆記
- 配色
- 主題
- 背景
- Agent 輸出
- 收藏內容

## 16.2 組織方式

- Project
- Collection
- Tag
- Favorite
- Archive
- Source
- Type
- Date

## 16.3 Asset Actions

- 預覽
- 改名
- 加 Tag
- 收藏
- 移動
- 複製
- 封存
- 刪除
- 設為背景
- 建立主題
- 問 Agent
- 加入 Timeline
- 指派專案

---

# 17. Figma 整合

## 17.1 目標

Figma 是第一個深度整合的設計工具。

## 17.2 功能

- OAuth
- 顯示權限
- 選擇檔案
- 讀取檔案結構
- 取得頁面或節點預覽
- 讀取文字
- 讀取顏色
- 讀取字體
- 讀取元件
- 建立快照
- 取得版本
- Webhook
- 比較版本
- 建立主題

## 17.3 隱私

禁止預設同步整個 Team。

使用者必須明確選擇：

- 哪個檔案
- 哪個 Project
- 是否同步新版
- 是否允許分析
- 是否保留原始 JSON

## 17.4 同步流程

```text
Figma Webhook
    ↓
驗證簽章
    ↓
建立 sync job
    ↓
取得檔案最新資料
    ↓
建立快照
    ↓
抽取特徵
    ↓
儲存 Preview
    ↓
更新 DesignFile
    ↓
選擇性建立 Insight
```

## 17.5 Rate Limit

不可每次頁面載入都重新抓整份 Figma 文件。

必須：

- 使用快取
- 使用快照
- 背景同步
- 去重
- Idempotency
- 指數退避
- 顯示同步時間

---

# 18. Canva 整合

## 18.1 路線一：Connect / Export

外部網站流程：

1. 使用者連接 Canva。
2. 使用者選擇設計。
3. SnowRealm Space 建立匯出任務。
4. Canva 產生檔案。
5. 系統下載到 R2。
6. 建立快照。
7. Vision 分析。
8. 建立主題或背景。

## 18.2 路線二：Canva App

未來可在 Canva 編輯器內提供：

- 當前頁面分析
- 色票建議
- 字體建議
- 版面檢查
- 儲存到 SnowRealm Space
- 取得 Agent 建議
- 建立替代方案

## 18.3 限制

不可假設外部 Connect API 能取得完整可編輯圖層資料。

功能必須依照 Canva 官方實際開放能力實作。

---

# 19. Adobe 整合

Adobe 不可當成單一 Provider 實作。

## 19.1 Adobe Express

可規劃：

- Express Add-on
- 文件內容存取
- 匯出預覽
- 傳送到 Space
- Agent 分析
- 主題建立

## 19.2 Photoshop

建議使用：

- UXP Plugin
- 匯出當前畫布
- 傳送預覽
- 傳送基本 metadata
- 取得 Agent 回饋

## 19.3 Illustrator

後續獨立規劃 Plugin。

## 19.4 手動匯出

所有 Adobe 工具都必須保留通用 fallback：

- 上傳 PNG
- 上傳 JPG
- 上傳 PDF
- 上傳導出檔

---

# 20. 通用設計軟體整合層

## 20.1 Adapter Interface

```ts
export interface DesignProviderAdapter {
  connect(userId: string): Promise<ConnectResult>;

  disconnect(connectionId: string): Promise<void>;

  listFiles(
    connectionId: string
  ): Promise<ExternalDesignFile[]>;

  getFile(
    connectionId: string,
    fileId: string
  ): Promise<ExternalDesignFile>;

  getPreview(
    connectionId: string,
    fileId: string
  ): Promise<PreviewResult>;

  getDocumentData?(
    connectionId: string,
    fileId: string
  ): Promise<Record<string, unknown>>;

  listVersions?(
    connectionId: string,
    fileId: string
  ): Promise<ExternalVersion[]>;

  syncFile(
    connectionId: string,
    fileId: string
  ): Promise<SyncResult>;
}
```

## 20.2 Provider Capability Matrix

每個 Provider 必須宣告能力：

```ts
export type ProviderCapabilities = {
  canListFiles: boolean;
  canReadStructure: boolean;
  canExportPreview: boolean;
  canListVersions: boolean;
  supportsWebhook: boolean;
  supportsInEditorApp: boolean;
};
```

前端只顯示實際支援的功能。

禁止顯示不可用按鈕後再用「Coming Soon」永久糊弄。

---

# 21. AI Agent

## 21.1 定位

Agent 是：

- 助手
- 創作夥伴
- 空間居民
- 設計評論者
- 整理者
- 記憶入口
- 導覽者

Agent 不是：

- 全知角色
- 情緒診斷工具
- 偷看所有檔案的監控者
- 不需確認即可執行任何操作的自動化機器

## 21.2 Agent Mode

- Companion
- Creative Director
- Design Reviewer
- Organizer
- Focus Partner
- Quiet Mode

## 21.3 Context Sources

- 當前頁面
- 當前主題
- 當前背景
- 當前專案
- 被選取作品
- 被選取快照
- 最近活動
- 已批准記憶
- 最近對話
- 每日事件

## 21.4 Agent 分析分類

所有內部陳述分類：

- Fact
- Metric
- Inference
- Suggestion
- Creative

前端可依需求顯示：

- 證據
- 信心值
- 來源

## 21.5 Agent Actions

- 建立筆記
- 建立專案
- 建立主題草稿
- 套用主題
- 建立背景播放清單
- 產生配色
- 比較版本
- 加 Tag
- 建立每日卡片
- 建立週報

需要確認的行為：

- 套用主題
- 大量修改 Tag
- 刪除
- 封存
- 中斷連線
- 對外分享
- 上傳到第三方
- 寫入外部設計文件

## 21.6 主動訊息

設定：

- Off
- Important Only
- Daily
- Adaptive
- Custom

觸發：

- 每日卡片
- 新作品同步
- 版本變更
- 專案停滯
- 週報
- 里程碑
- Provider 失敗
- 新洞察

頻率必須有限制。

---

# 22. Memory System

## 22.1 記憶類型

- 明確偏好
- 專案背景
- 設計偏好
- 常見習慣
- 里程碑
- 私人筆記
- Agent 摘要
- 使用者指定記憶

## 22.2 MemoryRecord

```ts
export type MemoryRecord = {
  id: string;
  ownerId: string;
  type: string;
  content: string;

  sourceType:
    | "user_explicit"
    | "agent_summary"
    | "activity"
    | "integration";

  sourceId?: string;

  confidence: number;
  sensitivity: "normal" | "private" | "restricted";
  approved: boolean;

  expiresAt?: string;

  createdAt: string;
  updatedAt: string;
};
```

## 22.3 規則

- 使用者明確陳述優先級最高
- 推測必須有信心值
- 推測不可當永久真相
- 敏感內容不可自動儲存
- 使用者可查看
- 使用者可修改
- 使用者可刪除
- 使用者可拒絕
- 使用者可匯出
- 已刪除內容不得再次進入檢索

## 22.4 記憶提案

Agent 可說：

> 我可以記住妳偏好低飽和粉色。要保存嗎？

只有使用者同意後才存為 approved memory。

---

# 23. Insight Engine

## 23.1 目的

將真實活動轉成可驗證觀察。

## 23.2 資料來源

- 頁面使用
- Widget 使用
- Theme 變更
- Background 變更
- 設計快照
- 專案活動
- Agent 對話
- 使用者 Check-In
- Provider 同步

## 23.3 Insight 類型

- 使用模式
- 創作模式
- 專案進度
- 風格演化
- 偏好趨勢
- 未完成工作
- 里程碑
- 每週摘要

## 23.4 Insight

```ts
export type Insight = {
  id: string;
  ownerId: string;
  type: string;

  title: string;
  statement: string;

  evidence: {
    metric?: string;
    value?: number;
    comparison?: number;
    sourceIds: string[];
  };

  confidence: number;
  visibility: "private" | "shareable";

  createdAt: string;
};
```

## 23.5 文案原則

禁止：

> 妳的設計成熟很多。

應改成：

> 最近四個版面使用的顏色數量比前四個少，留白比例也增加。整體看起來更安靜，但兩個手機版 CTA 的對比下降。

---

# 24. Daily System

## 24.1 每日內容

- Daily Card
- Agent Note
- Creative Prompt
- Background Event
- Theme Suggestion
- Unfinished Work Nudge
- Memory Callback
- Milestone
- Surprise

## 24.2 生成邏輯

每日內容應結合：

- 固定內容池
- 隨機
- 使用者活動
- 專案狀態
- 最近內容
- 避免重複
- 安全過濾
- 時區

## 24.3 重複控制

- 同類型不可連續三天
- 相同 quote 30 天內不重複
- 相同 prompt 60 天內不重複
- 稀有事件有冷卻時間
- 同一 Insight 不反覆改寫

## 24.4 錯過處理

普通每日內容：

- 24 小時突出顯示
- 之後進 Archive
- 不應永久消失

真正限時活動：

- 必須清楚標示
- 不得假裝限時

---

# 25. Surprise Engine

## 25.1 驚喜類型

- 一句話
- 圖片
- Agent 信件
- Prompt
- 背景
- 主題
- 貼圖
- 動畫
- 小遊戲
- 歷史回顧
- 稀有角色互動

## 25.2 稀有度

- Common
- Uncommon
- Rare
- Special
- Anniversary

## 25.3 規則

- 不出售假機率
- 不誤導
- 每日驚喜不可成為壓力
- 驚喜可被收藏
- 稀有內容應有保底或清楚規則
- Birthday Alpha 可使用固定生日驚喜鏈

---

# 26. Timeline

## 26.1 事件類型

- 建立專案
- 上傳作品
- 同步新版
- 完成設計
- 建立主題
- 套用主題
- 連接 Provider
- 儲存記憶
- 完成反思
- 解鎖驚喜
- 達成里程碑

## 26.2 View

- 時間順序
- Project
- Year
- Category
- Gallery
- On This Day

## 26.3 Timeline 隱私

每筆事件可設定：

- Private
- Shareable
- Hidden

---

# 27. Project System

## 27.1 Project

```ts
export type Project = {
  id: string;
  spaceId: string;
  name: string;
  description?: string;

  status:
    | "idea"
    | "active"
    | "paused"
    | "completed"
    | "archived";

  coverAssetId?: string;
  tags: string[];

  createdAt: string;
  updatedAt: string;
};
```

## 27.2 Project 功能

- 建立
- 封面
- 描述
- Tag
- 狀態
- 關聯作品
- 關聯筆記
- 關聯 Timeline
- 關聯 Agent Thread
- 最近活動

---

# 28. Notification System

## 28.1 Birthday Alpha

只做 In-App。

## 28.2 未來 Channels

- Email
- Web Push
- Mobile Push
- Messaging App

## 28.3 類型

- 同步成功
- 同步失敗
- 每日內容
- Agent 訊息
- 週報
- 里程碑
- OAuth 過期
- 背景處理完成

## 28.4 設定

- Quiet Hours
- Frequency Cap
- Category Control
- Channel Control
- One-click Disable

---

# 29. Search System

## 29.1 搜尋層

- Metadata
- Full Text
- Semantic Search
- Visual Similarity

Birthday Alpha 只需：

- 名稱
- Tag
- Project
- 類型
- 日期

## 29.2 未來語意搜尋

例如：

- 找粉色風格的作品
- 找去年做過的登入頁
- 找 Agent 說過的字體建議
- 找有星空背景的主題

---

# 30. Onboarding

## 30.1 Birthday Alpha 流程

1. 打開私人邀請
2. 輸入或確認名字
3. 顯示生日歡迎
4. 選擇視覺氛圍
5. 選擇背景
6. 選擇字體配對
7. 選擇 Agent 類型
8. 可選擇上傳第一張作品
9. 進入 Home Space
10. 解鎖生日驚喜

## 30.2 原則

- 不能超過必要步驟
- 每一步有 Skip
- 所有設定之後可改
- 不要求一開始連接所有 Provider
- 不要求一次授權所有資料

---

# 31. 使用者設定

## 31.1 Appearance

- Theme
- Font
- Background
- Layout
- Motion
- Sound

## 31.2 Agent

- Mode
- Tone
- Proactive Frequency
- Memory
- Avatar
- Position

## 31.3 Privacy

- Activity Tracking
- AI Analysis
- Memory
- Provider Data
- Public Sharing
- Export
- Delete

## 31.4 Integrations

- Figma
- Canva
- Adobe Express
- Photoshop
- Other

---

# 32. 隱私與安全

## 32.1 核心要求

- OAuth Token 加密
- Refresh Token 加密
- Token 不可回傳前端
- Row Level Security
- Signed Upload URL
- Webhook Signature Validation
- CSRF 防護
- Rate Limit
- Audit Log
- Session 管理
- Secret 進 Secret Manager
- 支援刪除
- 支援匯出
- Provider Scope 最小化

## 32.2 同意

必須取得明確同意：

- Provider 連接
- 檔案同步
- AI 分析
- 行為分析
- 長期記憶
- 主動訊息
- 敏感內容處理

## 32.3 刪除

使用者可：

- 刪除單一 Asset
- 刪除 Design Snapshot
- 刪除 Memory
- 刪除 Insight
- 中斷 Provider
- 刪除 Provider 派生資料
- 刪除帳號
- 匯出後刪除

## 32.4 AI 資料聲明

必須清楚說明：

- 哪些內容送到 AI Provider
- 為何送出
- 是否保留
- 是否用於訓練
- 使用者有哪些控制

---

# 33. 系統架構

## 33.1 建議 Stack

- Next.js
- React
- TypeScript
- Supabase Auth
- PostgreSQL
- Supabase RLS
- Cloudflare R2
- Background Job Queue
- Cron
- LLM Provider Abstraction
- Vision Provider Abstraction
- pgvector
- Analytics Event Pipeline

## 33.2 Service Boundary

```text
Web App
├── Auth Service
├── Space Service
├── Theme Service
├── Background Service
├── Font Service
├── Widget Service
├── Project Service
├── Asset Service
├── Design Integration Service
├── Agent Service
├── Memory Service
├── Insight Service
├── Daily Service
├── Timeline Service
└── Notification Service
```

## 33.3 BFF

前端不直接呼叫第三方 Provider。

所有 Provider 請求經過 Server Route 或 Backend Service。

---

# 34. 資料庫設計

## 34.1 核心 Tables

```text
profiles
spaces
space_members
themes
theme_versions
fonts
font_pairs
backgrounds
background_playlists
background_playlist_items
layouts
widget_definitions
widget_instances
projects
assets
asset_versions
design_connections
design_files
design_snapshots
design_insights
agent_threads
agent_messages
memories
activity_events
daily_items
surprises
timeline_events
notifications
provider_webhooks
jobs
audit_logs
feature_flags
```

## 34.2 spaces

```sql
create table spaces (
  id uuid primary key,
  owner_id uuid not null,
  name text not null,
  slug text unique not null,
  description text,
  active_theme_id uuid,
  active_layout_id uuid,
  privacy text not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## 34.3 themes

```sql
create table themes (
  id uuid primary key,
  space_id uuid not null,
  name text not null,
  definition jsonb not null,
  is_active boolean not null default false,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## 34.4 fonts

```sql
create table fonts (
  id uuid primary key,
  family text not null,
  slug text unique not null,
  category text not null,
  supported_languages text[] not null,
  weights integer[] not null,
  styles text[] not null,
  preview_text text,
  file_manifest jsonb not null,
  license_name text not null,
  license_url text not null,
  attribution_required boolean not null default false,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
```

## 34.5 backgrounds

```sql
create table backgrounds (
  id uuid primary key,
  space_id uuid not null,
  owner_id uuid not null,
  type text not null,
  source_url text,
  thumbnail_url text,
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## 34.6 design_connections

```sql
create table design_connections (
  id uuid primary key,
  user_id uuid not null,
  provider text not null,
  external_account_id text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  scopes text[],
  expires_at timestamptz,
  status text not null,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## 34.7 design_files

```sql
create table design_files (
  id uuid primary key,
  owner_id uuid not null,
  provider text not null,
  external_id text,
  title text not null,
  description text,
  source_url text,
  thumbnail_url text,
  project_id uuid,
  tags text[] not null default '{}',
  sync_status text not null default 'manual',
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## 34.8 design_snapshots

```sql
create table design_snapshots (
  id uuid primary key,
  design_file_id uuid not null,
  external_version_id text,
  preview_url text not null,
  document_data_url text,
  extracted_features jsonb not null default '{}',
  checksum text not null,
  created_at timestamptz not null default now()
);
```

## 34.9 memories

```sql
create table memories (
  id uuid primary key,
  space_id uuid not null,
  user_id uuid not null,
  type text not null,
  content text not null,
  source_type text not null,
  source_id text,
  confidence numeric not null default 1,
  sensitivity text not null default 'normal',
  approved boolean not null default false,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## 34.10 activity_events

```sql
create table activity_events (
  id uuid primary key,
  space_id uuid not null,
  user_id uuid not null,
  event_type text not null,
  entity_type text,
  entity_id uuid,
  properties jsonb not null default '{}',
  occurred_at timestamptz not null default now()
);
```

---

# 35. API 規格

## 35.1 Theme

```text
GET    /api/themes
POST   /api/themes
GET    /api/themes/:id
PATCH  /api/themes/:id
DELETE /api/themes/:id
POST   /api/themes/:id/apply
POST   /api/themes/from-image
POST   /api/themes/import
GET    /api/themes/:id/export
```

## 35.2 Background

```text
POST   /api/backgrounds
PATCH  /api/backgrounds/:id
DELETE /api/backgrounds/:id

POST   /api/background-playlists
PATCH  /api/background-playlists/:id
DELETE /api/background-playlists/:id

POST   /api/background-playlists/:id/items
PATCH  /api/background-playlists/:id/items/reorder
```

## 35.3 Design

```text
GET    /api/design/files
POST   /api/design/files/upload
GET    /api/design/files/:id
PATCH  /api/design/files/:id
DELETE /api/design/files/:id

POST   /api/design/files/:id/sync
GET    /api/design/files/:id/snapshots
POST   /api/design/snapshots/:id/analyze
POST   /api/design/snapshots/:id/create-theme
```

## 35.4 Agent

```text
POST   /api/agent/messages
GET    /api/agent/threads
GET    /api/agent/threads/:id
POST   /api/agent/actions/:action
```

## 35.5 Memory

```text
GET    /api/memories
POST   /api/memories
PATCH  /api/memories/:id
DELETE /api/memories/:id
POST   /api/memories/:id/approve
POST   /api/memories/:id/reject
```

## 35.6 Integration

```text
GET    /api/integrations
POST   /api/integrations/:provider/connect
GET    /api/integrations/:provider/callback
POST   /api/integrations/:connectionId/disconnect
GET    /api/integrations/:connectionId/files
POST   /api/integrations/:connectionId/sync
```

---

# 36. 事件系統

## 36.1 命名

```text
space.opened
theme.created
theme.updated
theme.applied
background.added
background.changed
playlist.started
asset.uploaded
design.synced
design.analyzed
agent.message.sent
agent.action.completed
memory.created
memory.approved
daily.item.opened
surprise.unlocked
project.created
project.completed
```

## 36.2 DomainEvent

```ts
export type DomainEvent = {
  id: string;
  type: string;
  spaceId: string;
  actorId: string;

  entityType?: string;
  entityId?: string;

  properties: Record<string, unknown>;
  occurredAt: string;
};
```

## 36.3 Consumers

- Analytics
- Timeline
- Insight Engine
- Agent Proactive Engine
- Notification
- Achievement
- Daily Personalization

---

# 37. 背景任務與 Queue

## 37.1 Jobs

- Token Refresh
- Figma Sync
- Canva Export Poll
- Preview Generation
- Thumbnail Generation
- Video Transcode
- Design Analysis
- Palette Extraction
- Daily Card
- Daily Event
- Insight Generation
- Weekly Recap
- Stale Upload Cleanup
- Notification Dispatch

## 37.2 Job Record

```ts
export type JobRecord = {
  id: string;
  type: string;
  status: "queued" | "running" | "completed" | "failed";
  payload: Record<string, unknown>;
  idempotencyKey: string;
  retryCount: number;
  lastError?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
};
```

---

# 38. 檔案儲存

## 38.1 儲存分類

- Original Upload
- Preview
- Thumbnail
- Provider Export
- Design Snapshot
- Background
- Font
- Theme Export
- User Export

## 38.2 R2 Path

```text
users/{userId}/spaces/{spaceId}/assets/{assetId}/original
users/{userId}/spaces/{spaceId}/assets/{assetId}/preview
users/{userId}/spaces/{spaceId}/assets/{assetId}/thumbnail

providers/{provider}/{connectionId}/{fileId}/{snapshotId}
fonts/{fontId}/{weight}/{subset}.woff2
```

## 38.3 原則

- Private Bucket
- Signed URL
- 短期存取
- 不公開原始檔
- Thumbnail 可快取
- 刪除需同步清理派生檔案

---

# 39. AI 架構

## 39.1 Provider Abstraction

```ts
export interface LLMProvider {
  generateText(input: LLMInput): Promise<LLMOutput>;
  streamText(input: LLMInput): AsyncIterable<LLMChunk>;
}

export interface VisionProvider {
  analyzeImage(input: VisionInput): Promise<VisionOutput>;
}
```

## 39.2 Context Builder

Context Builder 根據任務取得：

- Active Space
- Active Theme
- Selected Asset
- Selected Design Snapshot
- Project
- Recent Thread
- Approved Memory
- Relevant Insight
- User Settings

## 39.3 Tool Calling

Agent Tool：

- create_note
- create_project
- create_theme_draft
- apply_theme
- create_palette
- add_background
- compare_design_versions
- tag_asset
- create_daily_card
- save_memory_proposal

所有 Tool 必須定義：

- input schema
- permission
- confirmation policy
- audit behavior
- rollback behavior

---

# 40. Prompt 管理

## 40.1 Prompt 必須版本化

```text
prompts/
  agent/
    system-v1.md
    design-review-v1.md
    theme-generator-v1.md
    memory-proposal-v1.md
    daily-card-v1.md
```

## 40.2 Prompt Metadata

- id
- version
- model
- temperature
- input schema
- output schema
- updatedAt
- owner
- changelog

## 40.3 結構化輸出

AI 分析盡可能使用 JSON Schema。

例如：

```json
{
  "observations": [],
  "metrics": [],
  "inferences": [],
  "suggestions": [],
  "confidence": 0.0,
  "evidence": []
}
```

---

# 41. 權限模型

## 41.1 Owner

- 完整控制
- Provider
- Memory
- Delete
- Export
- Agent
- Theme
- Layout

## 41.2 Guest

- 只能看公開內容
- 不可看 Memory
- 不可看 Private Timeline
- 不可看 Provider

## 41.3 Collaborator

V2 之後。

- 指定 Project 權限
- 上傳
- 留言
- 編輯部分 Collection

---

# 42. 效能要求

## 42.1 Birthday Alpha

- FMP < 2.5 秒
- Home 可互動 < 4 秒
- Theme 切換 < 150ms
- Widget 拖曳盡可能 60fps
- Palette Extraction < 3 秒
- 首屏不可被中文字體阻塞
- 大型 AI 任務使用背景 Job

## 42.2 策略

- Dynamic Import
- Route Splitting
- Responsive Image
- Thumbnail
- Optimistic UI
- Query Cache
- Theme JSON Cache
- Video Transcode
- Font On Demand
- Provider Data Snapshot

---

# 43. 無障礙要求

- Keyboard Navigation
- Focus State
- ARIA Label
- Reduced Motion
- Pause Video
- Contrast
- Text Scaling
- Screen Reader
- 不以顏色作唯一訊息
- 所有動畫有 fallback
- 背景文字可讀性保護

---

# 44. 分析與指標

## 44.1 指標

- DAU
- WAU
- Day 1 Retention
- Day 7 Retention
- Themes Created
- Themes Applied
- Backgrounds Added
- Slideshow Enabled
- Design Uploads
- Provider Connections
- Agent Sessions
- Daily Items Opened
- Surprises Opened
- Memories Approved
- Average Session Length

## 44.2 North Star Metric

> Meaningful Space Days per Active User per Week

Meaningful Space Day：

- 打開 Daily Item
- 建立或套用 Theme
- 上傳或查看作品
- 與 Agent 有有效互動
- 儲存記憶
- 完成 Project Action

---

# 45. 測試策略

## 45.1 Test Layer

- Unit
- Component
- API
- Integration Adapter
- Provider Mock
- E2E
- Accessibility
- Visual Regression
- Security

## 45.2 Critical E2E

- Onboarding
- Theme Creation
- Theme Apply
- Background Upload
- Slideshow
- Widget Layout
- Design Upload
- Theme From Image
- Agent Chat
- Memory Approve
- Asset Delete
- Provider Disconnect
- Account Export
- Account Delete

---

# 46. 錯誤處理

## 46.1 Provider

顯示：

- 發生什麼
- 是否可重試
- 是否需重新授權
- 已同步資料是否安全
- 上次成功時間

## 46.2 AI

- 保留輸入
- 可重試
- 不生成假結果
- 區分 Timeout
- 區分 Refusal
- 支援手動完成

## 46.3 Upload

檢查：

- File Type
- File Size
- Corruption
- Unsupported Animation
- Storage Limit

---

# 47. Feature Flag

所有未完成大功能需 Feature Flag。

例如：

```text
feature.figmaIntegration
feature.canvaConnect
feature.canvaApp
feature.adobeExpress
feature.photoshopPlugin
feature.publicPortfolio
feature.collaboration
feature.marketplace
```

未開啟功能不可出現在一般使用者主流程。

---

# 48. Birthday Alpha 範圍

## 48.1 Must Have

- 私人邀請或登入
- 個人化 Onboarding
- Home Space
- 背景上傳
- 背景幻燈片
- 3 種轉場
- Theme Editor
- 色彩選擇
- 圖片取色
- 5–8 套字體
- 字體配對
- Glass / Solid Card
- Widget 拖曳
- Agent Chat
- Agent Theme Suggestion
- 手動上傳作品
- 作品設背景
- 圖片生成主題
- Daily Card
- Surprise Box
- Timeline 基礎
- Delete Control
- Mobile Web

## 48.2 Nice to Have

- Figma OAuth
- Current Project Widget
- Agent Avatar Animation
- Time-based Background
- Background Audio
- Weekly Recap

## 48.3 Out of Scope

- Canva App 發布
- Adobe Plugin 發布
- Marketplace
- Collaboration
- Social Feed
- Native App
- 完整桌面控制 Agent

---

# 49. V1 範圍

- 正式 Auth
- Figma OAuth
- 指定檔案同步
- Design Snapshot
- Version Comparison
- Design Analysis
- Advanced Theme Studio
- Time-based Playlist
- Memory Center
- Insight Center
- Weekly Recap
- Integration Center
- Export
- Delete Workflow
- Responsive Mobile Web

---

# 50. V2 範圍

- Canva Connect
- Canva App
- Adobe Express Add-on
- Photoshop Plugin
- Theme Sharing
- Public Portfolio
- Collaborator
- Plugin 基礎
- Advanced Timeline
- Visual Similarity Search
- Push Notification

---

# 51. V3 長期方向

- Theme Marketplace
- Widget Marketplace
- Creator Island 串接
- AI Island 個人學習房間
- Shared Space
- Multi-Agent
- Public Space
- Native Desktop
- Native Mobile
- VR / 3D Space
- Creator Memory
- Workspace Memory
- Revenue Sharing
- Developer SDK

---

# 52. 開發里程碑

## Milestone A：Foundation

- Repository
- Auth
- Database
- R2
- Space Shell
- Token System
- Event Foundation
- Audit Foundation

## Milestone B：Visual Personalization

- Theme Engine
- Font System
- Background Studio
- Layout Editor
- Live Preview

## Milestone C：Creative Core

- Project
- Asset Upload
- Library
- Theme From Image
- Timeline

## Milestone D：AI Core

- Agent
- Context Builder
- Memory
- Theme Suggestion
- Design Analysis

## Milestone E：Daily Loop

- Daily Card
- Surprise
- Proactive Rules
- Activity Events
- Insight Basics

## Milestone F：Integration

- Figma
- Canva
- Adobe

---

# 53. Repository 建議結構

```text
apps/
  web/
    app/
    components/
    features/
      home-space/
      theme-studio/
      background-studio/
      design-hub/
      agent/
      memory/
      timeline/
      daily/
      settings/
    lib/
    styles/

packages/
  ui/
  theme-engine/
  font-engine/
  widget-engine/
  agent-core/
  memory-core/
  design-adapters/
  analytics/
  shared-types/
  validation/

supabase/
  migrations/
  seed/
  functions/

prompts/
  agent/
  design/
  theme/
  memory/
  daily/

docs/
  product/
  architecture/
  integrations/
  security/
  ux/
```

---

# 54. Claude Code 執行規範

將本文件放進 repository 後，使用以下 Prompt：

```text
You are implementing SnowRealm Space from the complete product and technical specification.

Before writing code:

1. Read the entire specification.
2. Inspect the current repository.
3. Produce:
   - architecture gap analysis
   - implementation plan
   - database migration plan
   - route map
   - component map
   - dependency list
   - risk list
4. Do not implement all modules at once.
5. Begin with Birthday Alpha.
6. Keep all external integrations behind adapters.
7. Do not fake provider data.
8. Do not fake AI analysis.
9. Use feature flags for unfinished modules.
10. Use strict TypeScript.
11. Validate all API input.
12. Add tests for every completed flow.
13. Run lint, typecheck, and tests after each milestone.
14. Do not silently ignore failures.
15. Summarize changed files and remaining risks after each milestone.

Implementation order:

1. authentication and private Space
2. database foundation
3. theme token engine
4. font engine
5. background upload
6. background slideshow
7. draggable Home Space widgets
8. design upload and preview
9. palette extraction
10. create theme from image
11. Agent chat with selected context
12. memory approval flow
13. daily card
14. surprise box
15. timeline basics
16. privacy and delete controls
17. Figma adapter skeleton
```

---

# 55. Definition of Done

Birthday Alpha 完成條件：

- Nami 可進入私人 Space
- Space 有個人化歡迎
- 可上傳背景
- 可建立幻燈片
- 可調整轉場
- 可自訂顏色
- 可選擇字體
- 可切換卡片材質
- 可拖曳 Widget
- 所有設定會保存
- 可上傳作品
- 可將作品設背景
- 可從作品建立主題
- 可與 Agent 對話
- Agent 能引用目前選取的作品或主題
- Agent 不會假裝看過未提供內容
- 可查看 Daily Card
- 可打開 Surprise
- 可查看 Timeline
- 可刪除上傳內容
- Desktop 與 Mobile Web 可使用
- Essential Flow 不存在假按鈕
- 未完成功能使用 Feature Flag 隱藏

---

# 56. 已知風險

## 56.1 範圍爆炸

最大風險是同時實作：

- Agent
- Theme
- Widget
- Figma
- Canva
- Adobe
- Timeline
- Memory
- Marketplace

處理方式：

- Birthday Alpha 嚴格限縮
- 外部整合先做 Adapter
- 未完成模組隱藏
- 每個 Milestone 必須有可用閉環

## 56.2 字體效能

繁中字體體積大。

處理：

- 子集
- 按需載入
- 限制初始字體
- WOFF2
- CDN

## 56.3 OAuth 與第三方審核

Canva、Adobe 可能需要 App 建立與審核。

處理：

- Birthday Alpha 不依賴審核
- 手動上傳作 fallback
- Provider Adapter 隔離

## 56.4 AI 幻覺

Agent 可能做錯誤分析。

處理：

- 結構化輸出
- Evidence
- Confidence
- 明確區分推測
- 不足資料時要求補充

## 56.5 隱私

設計作品可能包含私密內容。

處理：

- Explicit Consent
- Selected File Only
- Delete
- Export
- Private Default
- No Training Claim Without Verification

---

# 57. 尚待決策事項

以下不阻塞 Birthday Alpha，但需要後續決定：

1. 正式產品名稱是否為 SnowRealm Space。
2. Nami Space 是否是獨立品牌或 Space Template。
3. Agent 外觀。
4. Agent 名稱。
5. 初始字體清單。
6. 是否加入背景音樂。
7. 是否生日當天加入固定劇情。
8. Birthday Alpha 是否登入制。
9. 是否沿用 SnowRealm Account。
10. Figma 是否趕在生日版。
11. 使用哪個 LLM。
12. 使用哪個 Vision Model。
13. Memory 預設是否關閉。
14. Daily Card 是否每日自動生成。
15. Surprise 是否保存至 Archive。
16. 是否允許使用者上傳自有字體。
17. Theme 是否允許分享。
18. 作品分析是否包含 WCAG。
19. 是否支援影片設為背景。
20. 是否需要公開 Portfolio Route。

---

# 最終產品驗證

SnowRealm Space 必須通過這個問題：

> 使用七天後，這個空間是否比第一天更像它的主人？

如果答案是否定的，它只是一個可換主題的 Dashboard。

如果答案是肯定的，它才開始成為真正的 Living Digital Habitat。
