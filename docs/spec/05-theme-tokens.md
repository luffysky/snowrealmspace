# Theme Token 系統與字體載入

> v1.0 §11 的 `ThemeDefinition` 與 §11.3 的 CSS 變數不對齊（type 有 success/warning/danger/motion/effects，CSS 只列了部分）。本檔給出完整映射、對比規則與繁中字體載入策略。

---

## 1. 完整 ThemeDefinition

```ts
// packages/theme-engine/src/types.ts
export type ThemeDefinition = {
  schemaVersion: 1
  name: string

  colors: {
    primary: HexColor
    secondary: HexColor
    accent: HexColor
    background: HexColor
    surface: RgbaColor          // 支援透明（毛玻璃）
    surfaceAlt: RgbaColor
    textPrimary: HexColor
    textSecondary: HexColor
    border: RgbaColor
    success: HexColor
    warning: HexColor
    danger: HexColor
    focusRing: HexColor         // ← v1.0 缺；ADR-011 要求
  }

  typography: {
    headingFontId: string
    bodyFontId: string
    uiFontId: string
    monoFontId?: string
    headingScale: number        // 1.0–1.6，作用於 --sr-scale-heading
    bodyScale: number           // 0.875–1.25
    lineHeight: number          // 1.2–2.0
    letterSpacing: number       // -0.05–0.15 em
  }

  surfaces: {
    style: 'solid' | 'glass' | 'soft' | 'outline'
    opacity: number             // 0–1
    blur: number                // 0–40 px
    radius: number              // 0–48 px
    borderWidth: number         // 0–4 px
  }

  effects: {
    shadow: 'none' | 'soft' | 'medium' | 'dramatic'
    glow: boolean
    noise: boolean
  }

  motion: {
    preset: 'none' | 'soft' | 'float' | 'playful' | 'cinematic'
    intensity: number           // 0–1
    reduceMotionFallback: boolean
  }

  backgroundPlaylistId?: string
}
```

新增於 v1.0 之外的：`schemaVersion`（匯入時判版本）、`colors.focusRing`（ADR-011 的 focus indicator 需要獨立 token，不能沿用 primary——primary 可能與背景對比不足）。

---

## 2. Token → CSS 變數完整映射

**規則：所有 UI 元件只能使用 `--sr-*` 變數，不得出現任何字面顏色值。** ESLint 規則強制（見 §7）。

```css
:root {
  /* ── 顏色（直接映射）────────────────────────── */
  --sr-primary:        #f3a7c3;
  --sr-secondary:      #ffdce8;
  --sr-accent:         #8c5870;
  --sr-background:     #fff7fb;
  --sr-surface:        rgba(255,255,255,.58);
  --sr-surface-alt:    rgba(255,255,255,.32);
  --sr-text-primary:   #38252d;
  --sr-text-secondary: #725461;
  --sr-border:         rgba(255,255,255,.42);
  --sr-success:        #3f9a72;
  --sr-warning:        #c98a2e;
  --sr-danger:         #c4536b;
  --sr-focus-ring:     #6b3d52;

  /* ── 衍生顏色（由引擎計算，非使用者設定）──────── */
  --sr-primary-hover:   /* primary L±6% */;
  --sr-primary-active:  /* primary L±12% */;
  --sr-on-primary:      /* 對 primary 對比 ≥4.5 的黑或白 */;
  --sr-on-accent:       /* 同上 */;
  --sr-text-disabled:   /* textSecondary 60% 但仍 ≥3:1 */;
  --sr-overlay-scrim:   /* 背景上文字的保護層，見 §4 */;

  /* ── 表面 ──────────────────────────────────── */
  --sr-radius:        24px;
  --sr-radius-sm:     calc(var(--sr-radius) * 0.5);
  --sr-radius-lg:     calc(var(--sr-radius) * 1.5);
  --sr-blur:          20px;
  --sr-surface-opacity: 0.58;
  --sr-border-width:  1px;

  /* ── 陰影（由 effects.shadow 選定）─────────────── */
  --sr-shadow-sm: 0 1px 2px rgba(0,0,0,.04);
  --sr-shadow-md: 0 4px 16px rgba(0,0,0,.08);
  --sr-shadow-lg: 0 12px 40px rgba(0,0,0,.12);

  /* ── 字體 ──────────────────────────────────── */
  --sr-font-heading: 'Playfair Display', var(--sr-font-fallback-serif);
  --sr-font-body:    'Noto Sans TC', var(--sr-font-fallback-sans);
  --sr-font-ui:      'Inter', var(--sr-font-fallback-sans);
  --sr-font-mono:    'JetBrains Mono', ui-monospace, monospace;
  --sr-font-fallback-sans:  system-ui, -apple-system, 'Segoe UI', 'PingFang TC', 'Microsoft JhengHei', sans-serif;
  --sr-font-fallback-serif: Georgia, 'Songti TC', 'Noto Serif TC', serif;

  /* ── 字級（scale 為倍率，不是絕對值）──────────── */
  --sr-scale-heading: 1.0;
  --sr-scale-body:    1.0;
  --sr-line-height:   1.6;
  --sr-letter-spacing: 0em;

  --sr-text-xs:  calc(0.75rem  * var(--sr-scale-body));
  --sr-text-sm:  calc(0.875rem * var(--sr-scale-body));
  --sr-text-md:  calc(1rem     * var(--sr-scale-body));
  --sr-text-lg:  calc(1.125rem * var(--sr-scale-body));
  --sr-text-h3:  calc(1.5rem   * var(--sr-scale-heading));
  --sr-text-h2:  calc(2rem     * var(--sr-scale-heading));
  --sr-text-h1:  calc(2.75rem  * var(--sr-scale-heading));

  /* ── 動態 ──────────────────────────────────── */
  --sr-motion-intensity: 1;
  --sr-duration-fast:  calc(120ms * var(--sr-motion-intensity));
  --sr-duration-base:  calc(240ms * var(--sr-motion-intensity));
  --sr-duration-slow:  calc(480ms * var(--sr-motion-intensity));
  --sr-ease: cubic-bezier(.22,.61,.36,1);
}

/* Reduced motion：不是關閉動畫，是把時長降到最低且移除位移 */
@media (prefers-reduced-motion: reduce) {
  :root { --sr-motion-intensity: 0.01; }
  *, *::before, *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
}
```

### 2.1 套用機制

主題切換必須 < 150ms（v1.0 §42.1）。作法：

```ts
// 只改變 :root 的 style property，不重新渲染 React 樹
export function applyTheme(def: ThemeDefinition) {
  const vars = compileThemeToCssVars(def)   // 純函式，可測試
  const root = document.documentElement
  // 單次批次寫入，避免多次 reflow
  root.style.cssText = Object.entries(vars).map(([k,v]) => `${k}:${v}`).join(';')
  root.dataset.surfaceStyle = def.surfaces.style
  root.dataset.motionPreset = def.motion.preset
}
```

**不得**用 React state 驅動主題顏色（會導致整棵樹重渲染，遠超 150ms）。React 只需要知道「哪個 theme id 是 active」，顏色全部走 CSS 變數。

`compileThemeToCssVars` 是純函式 → 單元測試覆蓋率必須 100%。

### 2.2 surfaces.style 的差異

```css
[data-surface-style="glass"] .sr-card {
  background: var(--sr-surface);
  backdrop-filter: blur(var(--sr-blur));
  border: var(--sr-border-width) solid var(--sr-border);
}
[data-surface-style="solid"] .sr-card {
  background: var(--sr-surface-opaque);   /* 引擎把 surface 疊到 background 上算出不透明色 */
  backdrop-filter: none;
  border: var(--sr-border-width) solid var(--sr-border);
}
[data-surface-style="soft"] .sr-card {
  background: var(--sr-surface-opaque);
  box-shadow: var(--sr-shadow-md);
  border: none;
}
[data-surface-style="outline"] .sr-card {
  background: transparent;
  border: var(--sr-border-width) solid var(--sr-text-secondary);
}
```

**`backdrop-filter` 有真實效能成本。** 規則：同一畫面上最多 12 個元素使用毛玻璃。Widget 超過 12 個時，非視窗內的 widget 自動降級為 `solid`。行動裝置上限降為 6。

---

## 3. 對比檢查（ADR-011）

### 3.1 引擎

```ts
// packages/theme-engine/src/contrast.ts
export function contrastRatio(fg: string, bg: string): number  // WCAG 2.2 relative luminance
export function wcagLevel(ratio: number, size: 'normal'|'large'|'ui'): 'fail'|'AA'|'AAA'

export type A11yReport = {
  pairs: Array<{
    label: string          // 'textPrimary on background'
    fg: string; bg: string
    ratio: number
    required: number
    level: 'fail' | 'AA' | 'AAA'
  }>
  worstRatio: number
  passesAA: boolean
}
```

### 3.2 必檢組合

儲存主題時計算並存入 `themes.a11y_report`：

| 組合 | 門檻 |
|---|---|
| textPrimary / background | 4.5 |
| textPrimary / surface（疊到 background 後） | 4.5 |
| textSecondary / background | 4.5 |
| textSecondary / surface | 4.5 |
| on-primary / primary | 4.5 |
| on-accent / accent | 4.5 |
| border / background | 3.0 |
| focusRing / background | 3.0 |
| focusRing / surface | 3.0 |
| danger / background | 4.5 |
| success / background | 4.5 |

半透明的 `surface` 必須先與 `background` 做 alpha compositing 再算對比——直接拿 rgba 算會得到錯誤結果。

### 3.3 未通過時的行為

依 ADR-011：**顯示警告但允許儲存**。套用時，以下元素強制使用 fallback：

```css
/* 主題 a11y 不合格時，引擎加上此 class */
.sr-a11y-fallback {
  --sr-focus-ring: #000000;      /* 或依 background 亮度選黑/白 */
  --sr-danger:     #b3261e;
  --sr-text-disabled: var(--sr-text-secondary);
}
```

作用範圍限於：focus indicator、錯誤訊息、disabled 狀態、表單驗證提示。**不覆寫使用者選的一般文字色**——那是他們的空間，我們只保護「不能失敗的功能性元素」。

Theme Studio 的 UI 必須即時顯示每組的比值，並在低於門檻時顯示具體改法（「把文字調暗 12% 即可達 4.5:1」），而不只是紅色叉叉。

---

## 4. 背景上的文字保護（v1.0 §43）

背景可以是任何圖片，文字對比無法預先保證。作法：

```ts
// asset.analyze_local job 計算背景在「文字區域」的平均亮度
localFeatures.textZoneLuminance = { top: 0.82, center: 0.41, bottom: 0.67 }
```

前端依此自動決定 scrim：

```css
.sr-on-background-text {
  /* scrim 強度由 --sr-overlay-scrim 控制，引擎依 textZoneLuminance 計算 */
  text-shadow: 0 1px 3px var(--sr-overlay-scrim);
}
.sr-hero-block::before {
  background: linear-gradient(transparent, var(--sr-overlay-scrim));
}
```

無 `textZoneLuminance` 資料時（分析未完成），預設使用中等強度 scrim，寧可稍微多一點也不要文字讀不到。

---

## 5. 字體載入（ADR-016）

### 5.1 問題規模

Noto Sans TC 完整字集 6–9 MB。整包載入會讓首屏完全阻塞——這是 v1.0 §42.1「首屏不可被中文字體阻塞」與 §56.2 的核心風險。

### 5.2 策略：unicode-range 分片

```css
/* fonts/noto-sans-tc/manifest.css —— 由建置腳本產生 */
@font-face {
  font-family: 'Noto Sans TC';
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/noto-sans-tc/400/0.woff2') format('woff2');
  unicode-range: U+4E00-4EFF, U+5000-50FF, ...;   /* 最高頻 500 字 */
}
@font-face {
  font-family: 'Noto Sans TC';
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/noto-sans-tc/400/1.woff2') format('woff2');
  unicode-range: U+5100-51FF, ...;
}
/* ... 約 100 片 */
```

瀏覽器只下載頁面實際用到字元所在的片。典型 UI 頁面命中 3–8 片，約 60–150 KB。

### 5.3 分片產生

```
scripts/build-fonts.ts
  1. 讀取 TC 字頻表（依常用度排序）
  2. 前 500 字 → 片 0（首屏 inline preload）
  3. 501–1500 → 片 1–2
  4. 其餘依 Unicode block 切成 ~100 片，每片目標 20–40 KB
  5. pyftsubset / fonttools 產生 woff2
  6. 輸出 manifest.css + file_manifest JSON 存入 fonts 表
```

拉丁字體（Inter、Playfair、JetBrains Mono）不需要分片，整包 < 40 KB。

### 5.4 載入順序

| 階段 | 載入 |
|---|---|
| HTML `<head>` | `<link rel="preload">` UI 字體片 0（僅此一個） |
| 首屏 CSS | inline UI 字體片 0 的 `@font-face` |
| 主題套用後 | 動態注入該主題實際使用的 heading / body 字體的 manifest.css |
| 使用者預覽其他字體 | 只載入該字體的片 0，用於預覽文字 |

**規則：一個主題只載入它實際引用的字體。** 換主題時卸載不再使用的 `@font-face`（移除 style 標籤）。

### 5.5 FOUT 處理

`font-display: swap` 會產生字體切換閃爍。緩解：

- fallback 字體用 `size-adjust` 對齊 metrics，減少版面位移
```css
@font-face {
  font-family: 'Noto Sans TC Fallback';
  src: local('PingFang TC'), local('Microsoft JhengHei');
  size-adjust: 100%;
  ascent-override: 88%;
  descent-override: 12%;
}
```
- CLS 目標 < 0.1

---

## 6. 主題來源

| 來源 | 路徑 | 成本 | 延遲 |
|---|---|---|---|
| `manual` | Theme Studio 手動 | 0 | 即時 |
| `from_image` | 本地 k-means 取色 | 0 | p95 < 3s |
| `from_mood` | `theme_from_mood`（免費模型） | 免費 | 非同步 |
| `imported` | JSON 匯入 | 0 | 即時 |
| `preset` | 內建預設 | 0 | 即時 |

### 6.1 from_image 演算法（純本地，ADR-012）

```
1. sharp 縮到 200×200
2. 轉 CIELAB 色彩空間（比 RGB 更符合人眼距離感）
3. k-means，k=5，10 次迭代，固定種子（同圖必得同結果）
4. 依叢集大小排序 → dominant / secondary / accent
5. 從中選出最亮與最暗作為 text / background 候選
6. 對比檢查：不足 4.5:1 時，自動調整 L 通道直到達標
7. 產生 3 個變體：明亮 / 柔和 / 深色
8. 每個變體跑完整 A11yReport
```

**固定種子是必要的**：同一張圖每次取色結果必須相同，否則使用者會覺得系統不穩定。

### 6.2 匯出格式（ADR-020）

```json
{
  "format": "snowrealm-theme",
  "schemaVersion": 1,
  "exportedAt": "2026-07-23T10:00:00Z",
  "name": "夏日粉霧",
  "definition": { ... },
  "fontRefs": [
    { "id": "...", "family": "Noto Sans TC", "slug": "noto-sans-tc" }
  ]
}
```

匯入時以 `slug` 比對本地 `fonts` 表；找不到則降級為同 `category` 的預設字體，並在 UI 明確告知哪個字體被替換。

---

## 7. 強制規則

ESLint / Stylelint 規則：

```js
// 禁止在 component 中出現字面顏色
'no-restricted-syntax': [
  'error',
  { selector: "Literal[value=/^#[0-9a-fA-F]{3,8}$/]", message: '請使用 --sr-* token' },
  { selector: "Literal[value=/^rgba?\\(/]",           message: '請使用 --sr-* token' },
]
```

豁免：`packages/theme-engine/**`、`*.stories.tsx`、預設主題的 seed 檔。

---

## 8. 驗收條件

```gherkin
Scenario: 主題切換效能
  When 使用者切換主題
  Then :root 的 CSS 變數在 150ms 內更新完成
  And React 元件樹不重新渲染

Scenario: 取色可重現
  Given 同一張圖片
  When 執行兩次 from_image
  Then 兩次產生的 palette 完全相同

Scenario: 取色結果保證可讀
  When 從任意圖片生成主題
  Then textPrimary 對 background 的對比 ≥ 4.5:1

Scenario: 不合格主題的 focus ring 仍可見
  Given 主題的 focusRing 對 background 對比為 1.8:1
  When 套用該主題
  Then 實際渲染的 focus indicator 對比 ≥ 3:1

Scenario: 首屏不被中文字體阻塞
  When 首次載入 Home Space
  Then 阻塞渲染的字體檔總計 < 100 KB
  And LCP < 2.5s（Fast 3G、中階手機）

Scenario: 匯入拒絕注入
  When 匯入的 JSON 中 colors.primary 為 "url(javascript:alert(1))"
  Then 回傳 400 VALIDATION_FAILED
  And 不建立任何主題

Scenario: 毛玻璃數量上限
  Given Home Space 有 20 個 widget 且主題為 glass
  When 渲染完成
  Then 使用 backdrop-filter 的元素不超過 12 個
```
