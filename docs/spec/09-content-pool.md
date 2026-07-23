# 內容池 — Daily、Surprise 與生日鏈

> v1.0 §24.3 要求「相同 quote 30 天內不重複、相同 prompt 60 天內不重複」，但全文沒有任何一則 quote 或 prompt。這一章補上內容本身與生成規則。
> 內容位置：`content/`（YAML，不進 DB，由 seed 腳本匯入）

---

## 1. 為什麼要有固定內容池

全部靠 AI 生成有三個問題：
1. **成本** —— 每天每個 space 至少 3 次呼叫，且是純粹可預先寫好的內容。
2. **品質不穩** —— 免費模型偶爾會產出空泛或奇怪的文案，而這是使用者每天第一眼看到的東西。
3. **重複控制困難** —— 要保證 30 天不重複，得先有可枚舉的集合。

作法：**固定池為主，AI 為輔。** AI 只負責需要引用當下脈絡的內容（如「你的『六月海報』已經 12 天沒動了」）。

---

## 2. 內容檔格式

```yaml
# content/daily/quotes.zh-TW.yaml
- id: q001
  text: 先做出來，再做好。
  tags: [creation, momentum]
  weight: 1.0
  minDaysSinceSignup: 0

- id: q002
  text: 你今天不需要做出最好的版本，只需要做出下一個版本。
  tags: [creation, pressure_relief]
  weight: 1.2

- id: q003
  text: 留白不是還沒完成，是完成的一部分。
  tags: [design, whitespace]
  weight: 1.0
  requiresTag: design      # 只有標記為設計取向的 space 才會出現
```

欄位：

| 欄位 | 說明 |
|---|---|
| `id` | 穩定不變。重複控制以此為鍵 |
| `text` | 內容本體 |
| `tags` | 用於避免同主題連續出現 |
| `weight` | 抽取權重，預設 1.0 |
| `minDaysSinceSignup` | 新使用者不該看到「你已經累積很多作品了」這類內容 |
| `requiresTag` | 條件出現 |
| `cooldownDays` | 覆寫預設冷卻期 |

---

## 3. 各池的規模與冷卻

| 池 | 檔案 | Alpha 最低數量 | 冷卻 |
|---|---|---|---|
| Quote | `daily/quotes.zh-TW.yaml` | 60 | 30 天 |
| Creative Prompt | `daily/prompts.zh-TW.yaml` | 80 | 60 天 |
| Greeting | `daily/greetings.zh-TW.yaml` | 30（依時段分組） | 7 天 |
| Background Event | `daily/background-events.yaml` | 12 | 14 天 |
| Surprise（common） | `surprise/common.yaml` | 40 | 14 天 |
| Surprise（uncommon） | `surprise/uncommon.yaml` | 20 | 30 天 |
| Surprise（rare） | `surprise/rare.yaml` | 10 | 90 天 |
| Surprise（special） | `surprise/special.yaml` | 6 | 一次性 |
| Surprise（anniversary） | `surprise/anniversary.yaml` | 4 | 每年一次 |

**數量下限的計算：** quote 冷卻 30 天，代表任何時刻至少要有 30 則可用。60 則給了 2 倍餘裕，避免「所有內容都在冷卻中」而無內容可出。

---

## 4. 內容範例

### 4.1 Quote（節錄，完整 60 則見檔案）

```yaml
- id: q004
  text: 改到第五版才對，不代表前四版是白做的。
  tags: [iteration, self_compassion]
- id: q005
  text: 你選的顏色會比你想像的更常被看見。
  tags: [design, color]
- id: q006
  text: 收藏很容易，做出來很難。今天做一點。
  tags: [action]
- id: q007
  text: 沒有靈感的日子，就整理素材。那也是在前進。
  tags: [low_energy, momentum]
- id: q008
  text: 一個好的排版，是讓人不會注意到排版。
  tags: [design, layout]
```

撰寫原則（對應 v1.0 §5.5）：
- ❌ 不用「你一定可以的！」這類空泛激勵
- ❌ 不製造罪惡感（「別人都在努力」）
- ❌ 不假裝了解使用者今天的狀態
- ✅ 具體、可執行、對創作者有實際意義
- ✅ 允許低能量的日子存在

### 4.2 Creative Prompt

```yaml
- id: p001
  text: 用三種顏色重做你最近一張設計。少一種顏色，多一點決定。
  tags: [color, constraint]
  estimatedMinutes: 20
- id: p002
  text: 找一張你三個月前的作品，只改字體，不改其他。
  tags: [typography, revisit]
  estimatedMinutes: 15
- id: p003
  text: 把今天看到的一個顏色記下來。不用馬上用。
  tags: [observation, low_effort]
  estimatedMinutes: 2
- id: p004
  text: 選一個你一直想做但沒開始的東西，只做封面。
  tags: [starting, project]
  estimatedMinutes: 30
```

`estimatedMinutes` 讓系統能依使用者近期活躍度調整：連續幾天沒動的使用者優先給 `estimatedMinutes <= 5` 的低門檻提示。

### 4.3 Greeting（依時段）

```yaml
morning:      # 05:00–11:00
  - id: g001
    text: 早安。今天的空間換了新背景。
    requiresBackgroundChanged: true
  - id: g002
    text: 早安。
afternoon:    # 11:00–17:00
  - id: g010
    text: 午安，回來看看。
evening:      # 17:00–21:00
  - id: g020
    text: 晚上好。
night:        # 21:00–05:00
  - id: g030
    text: 這麼晚還在。
  - id: g031
    text: 夜深了，慢慢來就好。
```

**`night` 分組不得出現任何催促或提醒未完成工作的內容。**

---

## 5. 選取演算法

```ts
export function pickDailyItem(input: {
  pool: PoolEntry[]
  spaceId: string
  localDate: string
  recentItems: { contentHash: string; localDate: string; tags: string[] }[]
  spaceContext: { daysSinceSignup: number; tags: string[]; recentActivityLevel: 'high'|'normal'|'low' }
}): PoolEntry | null
```

```
1. 濾除冷卻中的（該 id 在 cooldownDays 內出現過）
2. 濾除不符條件的（minDaysSinceSignup、requiresTag）
3. 濾除與前兩天 tag 重疊的      ← v1.0 §24.3「同類型不可連續三天」
4. 依 recentActivityLevel 調整權重
     low  → estimatedMinutes ≤ 5 的權重 ×3
     high → 無調整
5. 加權隨機抽取
6. 候選為空 → 放寬第 3 條再試
7. 仍為空 → 放寬冷卻至一半再試
8. 仍為空 → 回 null，改用 AI 生成（usage key: daily_card，免費模型）
```

第 6–8 步的降級鏈是必要的。硬性規則在小內容池 + 長期使用者身上必然會出現「無內容可選」，此時**寧可稍微重複也不要空白**。

---

## 6. 稀有度與機率（v1.0 §25）

| 稀有度 | 每日機率 | 保底 |
|---|---|---|
| `common` | 70% | — |
| `uncommon` | 22% | — |
| `rare` | 7% | **連續 20 天未出 rare 則必出** |
| `special` | 1% | 由條件觸發，非隨機 |
| `anniversary` | — | 日期觸發 |

### 6.1 誠實原則（v1.0 §25.3）

- **機率必須公開。** `/settings/about/surprises` 顯示上表。
- **保底必須真實實作**，不是文案。`surprise_pity_counter` 存在 `space_settings`。
- **不得**顯示「還差一點就開出稀有！」這類假暗示。
- **不得**因為使用者長期未登入就給更好的獎勵來誘導回訪。

### 6.2 special 的觸發條件

不是隨機，而是里程碑：

```yaml
- id: s001
  rarity: special
  trigger: first_theme_created
  title: 第一套主題
  body: 這是你自己配的第一套顏色。它會一直留在這裡。
- id: s002
  rarity: special
  trigger: tenth_asset_uploaded
- id: s003
  rarity: special
  trigger: first_project_completed
- id: s004
  rarity: special
  trigger: thirty_days_active
```

---

## 7. 生日鏈（v1.0 §57.7 的結構）

Birthday Alpha 的核心體驗。以 `chain_key = 'birthday_2026'` 的有序 surprise 實作。

```yaml
# content/surprise/birthday-chain.yaml
chainKey: birthday_2026
unlockMode: sequential      # 必須依序解鎖
items:
  - chainIndex: 0
    title: 這裡是為你做的
    body: |
      這個空間還很空。
      接下來的每一樣東西，都會是你自己放進去的。
    availableFrom: onboarding_complete

  - chainIndex: 1
    title: 第一個顏色
    body: 你剛剛選的顏色會變成這個空間的底色。之後隨時可以改。
    availableFrom: first_theme_applied

  - chainIndex: 2
    title: 你的第一件作品
    availableFrom: first_asset_uploaded

  - chainIndex: 3
    title: 一封信
    bodyRef: content/letters/birthday-letter.md   # 長文另存
    availableFrom: birthday_date

  - chainIndex: 4
    title: 一年後
    body: 這個會在明年的今天打開。
    availableFrom: birthday_date_next_year
    rarity: anniversary
```

**`availableFrom` 是條件不是時間。** 這讓生日鏈不依賴使用者剛好在生日當天登入——ADR-001 取消硬期限後尤其重要。

`chainIndex: 4` 的設計對應 v1.0 的最終驗證問題（「七天後這個空間是否更像它的主人」）：它是唯一一個刻意跨越長時間的內容，用來證明這個空間會持續存在。

### 7.1 生日信

`content/letters/birthday-letter.md` 由專案負責人親筆撰寫，**不由 AI 生成**。規格只保留位置與載入機制。

---

## 8. 錯過處理（v1.0 §24.4）

| 類型 | 行為 |
|---|---|
| 一般 daily item | 24 小時內在 Home 突出顯示 → 之後 `archived` → **Archive 中永久可讀** |
| Surprise | 無時效，未開啟就一直在 |
| `anniversary` | 有 `expires_at`，過期後進 Archive 並標示「去年的」 |
| 真正限時 | Alpha 沒有任何真正限時的內容 |

**禁止**顯示「已過期，無法查看」。v1.0 §24.4 明確要求「不應永久消失」。

---

## 9. 安全過濾

所有內容（含 AI 生成的）在寫入 `daily_items` 前必須通過：

```ts
function passesContentFilter(text: string): boolean {
  return !FORBIDDEN_PATTERNS.some(re => re.test(text))
}
```

沿用 `07-agent.md` §6.2 的 `FORBIDDEN_PATTERNS`，另加：

```ts
const DAILY_EXTRA_FORBIDDEN = [
  /你(應該|必須|得)要/,          // 命令語氣
  /為什麼(你)?還沒/,             // 質問
  /別人都/,                      // 比較
  /浪費(了)?時間/,
]
```

未通過 → 丟棄並重新抽取（最多 3 次）→ 仍失敗則使用該池中 `id` 最小的保底內容。

---

## 10. Seed 與驗證

```
scripts/seed-content.ts
  1. 讀取 content/**/*.yaml
  2. 驗證：
     - id 全域唯一
     - 每個池達到 §3 的最低數量        ← 未達則 build 失敗
     - text 通過 §9 的安全過濾          ← 未通過則 build 失敗
     - text 長度符合各池上限
     - chainIndex 連續無跳號
  3. 匯入 DB（upsert by id）
```

**內容數量檢查放在 build 而非執行期。** 內容不足是可以在開發時就發現的問題，不該等到使用者看到空白畫面。

---

## 11. 驗收條件

```gherkin
Scenario: 冷卻期內不重複
  Given quote q001 在 10 天前出現過
  When 今天抽取 quote
  Then 不會抽到 q001

Scenario: 同 tag 不連續三天
  Given 前兩天的 daily item 都有 tag 'design'
  When 今天抽取
  Then 抽到的內容不含 tag 'design'

Scenario: 內容池耗盡時降級而非空白
  Given 所有 quote 都在冷卻期內
  When 抽取 quote
  Then 系統放寬冷卻條件並回傳一則內容
  And 不回傳 null

Scenario: 低活躍使用者得到低門檻提示
  Given 使用者近 7 天無任何活動
  When 抽取 creative prompt
  Then 抽到的 estimatedMinutes ≤ 5 的機率顯著提高

Scenario: rare 保底
  Given 連續 20 天未開出 rare
  When 今天開啟 surprise
  Then 必定為 rare 或更高

Scenario: 過期內容仍可查看
  Given 某 daily item 是 30 天前的
  When 使用者開啟 Archive
  Then 該內容完整可讀

Scenario: 夜間不催促
  When 在 21:00–05:00 生成 greeting
  Then 內容不含任何未完成工作的提醒

Scenario: 內容不足時 build 失敗
  Given quotes.zh-TW.yaml 只有 30 則
  When 執行 seed-content
  Then 腳本以非零狀態碼結束
  And 錯誤訊息指出需要 60 則
```
