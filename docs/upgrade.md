# SnowRealm Space — 可以升級的地方

> 2026-08-18 寫。作者讀過 `apps/`、`packages/`、`scripts/`、`.github/workflows/ci.yml`
> 與 `supabase/migrations/` 之後的判斷，不是複述 README。
>
> 對照組是 `D:\SnowRealmRebirth\1page`。
>
> ⚠️ **這一份的語氣與其他七份不一樣。** 這個專案的工程基礎是八個裡最好的，
> 所以下面不是「補基本功」，是「你已經有的東西還差最後一哩」。

---

## 一、這個專案在做什麼、現在到哪裡

一個會隨長期使用而成長的私人數位空間。

```text
架構    pnpm workspace + turbo，2 個 app（web / worker）、13 個 package
規模    780 個 TS/TSX、62 份 migration、**75 個測試檔**
內容    背景與主題引擎、335+ canvas 場景、Lottie、裝飾品、媒體庫、
        字體子集化、可拖拉版面、27+ 種 widget、天氣、AI
```

**它已經有的，其他七個專案沒有**：

```text
CI              .github/workflows/ci.yml，跑本地 Supabase stack
                （而且註解寫明「這不是機密——每個 supabase start 都一樣」）
check:rls       每張帶 space_id 的表都要有 RLS 與至少一條 policy，
                沒有 space_id 卻仍需 RLS 的表列成具名清單**並寫了理由**
check:secrets   獨立的機密掃描
check:deps      dependency-cruiser 管 13 個 package 之間的方向
test:rls        獨立的 vitest 設定，繞過所有前端程式碼驗 RLS
test:a11y       / test:visual / test:e2e / test:e2e:mobile 各自分開
registry.test   widget 註冊表有測試——那正是「反過來問」的形狀
```

`check-rls.ts` 的檔頭那句話值得抄進其他專案：

> 這個檢查在 CI 執行 —— 忘了寫 policy 會讓 build 失敗，而不是等到資料外洩才發現。

**所以這一份能挑的毛病不多，但有一個很明確。**

---

## 二、最該先修的三件事

### 1. 🔴 全專案沒有一行 CSP

`apps/web/next.config.mjs` 與 `apps/web/middleware.ts` 都沒有 `headers()`，
整個 repo 搜 `Content-Security-Policy` 是 **0 個結果**。

⚠️ 這一條之所以排第一，不是因為它最危險，是因為
**它是這個專案最容易被誤以為已經有的東西**。

理由很具體：你有 `check:rls`、`check:secrets`、`check:deps`、
RLS 測試、a11y 測試、視覺測試——一整排綠燈。
而**沒有任何一項在問「有沒有 CSP」**。

1page 踩過一模一樣的：security 稽核 21 項全綠，跑了三天，
而整個專案一行 CSP 都沒有。那份稽核只證明它問過的問題。

這個專案的風險又比一般網站高一階，因為它的核心功能就是
**讓使用者上傳圖片與影片、貼 Lottie JSON、選字體**——
每一項都是外部內容進到頁面裡。

**具體要放什麼**（照 1page 的 `lib/security/csp.ts`）：

```text
frame-src        只放真的需要嵌入的來源，其餘 'none'
object-src       'none'
base-uri         'self'
form-action      'self'
frame-ancestors  'none'
connect-src      要放 Supabase 與 R2 —— ⚠️ 這一條會擋掉媒體上傳
img-src / media-src  要放 R2 的自訂網域
font-src         字體是自架的，'self' 就夠
```

⚠️ **兩個 1page 實際踩過的坑，直接繞開**：

```text
1. 加了 CSP 之後媒體上傳整整壞了一天沒人發現——connect-src
   沒放 R2 的 S3 端點。加完一定要實測一次上傳
2. 不要用 nonce。Next 的 nonce 方案要求每頁動態渲染
   （靜態產生與 CDN 快取全失效），而且 style-src 的 nonce
   對 style="" 屬性無效——而主題引擎正是用 inline style 注入變數。
   誠實說明「這份 CSP 擋的是嵌入與注入管道」比追求滿分有用
```

然後**加一條稽核**，而且要驗**真的送出去了**（curl 看標頭），
不是「原始碼裡有沒有寫」。1page 的 `audit-security.mjs` 就是這樣做的——
那個差別在這個專案特別重要，因為你們的檢查腳本已經很多，
再多一支比對原始碼的假檢查只會讓那排綠燈更不可信。

### 2. `verify-pages.ts` 寫死了 14 條路由，而且不在 CI 裡跑

這一條不是「你少了一個東西」，是「你已經有的那個東西正在過期」。

`scripts/verify-pages.ts` 帶著真 session 逐頁確認 200 且沒有 Next.js
錯誤標記——**作法完全正確**（帶 session 這件事很多人會漏，
因為匿名爬蟲看不到登入後的頁面）。

問題是它的清單：

```ts
const PAGES = ['/home', '/library', '/projects', '/works', '/timeline',
  '/principles', '/surprises', '/insights', '/settings', '/settings/data',
  '/settings/memory', '/studio/theme', '/studio/background']
```

**14 條寫死的路由。** 而這個專案有背景商店、媒體庫、字體後台、
版面編輯、27+ widget 的設定頁——之後每加一頁，這份清單就更不完整一點，
**而它照樣全綠**。

1page 踩過一模一樣的：`authed-breakpoints.spec.ts` 的後台段落
寫死三條路由（那是當時後台的全部），之後加的六個頁面一條都沒被掃過，
而測試的名字說它在檢查「後台」。0815 才發現。
0818 又在會員區發現同一份——那時它**剛好還是完整的**，
而「剛好還對」與「不會過期」是兩回事。

**怎麼修（兩件事）**：

```text
a. 清單改成從磁碟列舉 apps/web 底下的 page.tsx，
   刻意不掃的列成具名清單**並寫理由**
   （你們的 check-rls.ts 已經是這個寫法，照抄就好）
b. 再問一次更根本的問題：**這條路由從首頁點得到嗎**。
   verify-pages 證明的是「打得開」，不是「找得到」。
   1page 犯過七次「做完了但畫面上沒有入口」，
   包含整套登入系統做完了選單上沒有連結
```

⚠️ 改完之後**故意刪掉一頁的入口連結**，確認守衛真的會紅。

### 2b. 12 支 `verify-*`，只有 1 支在 CI 裡

實際比對過 `.github/workflows/ci.yml`：

```text
✅ verify-milestone-a.ts
❌ verify-account-delete / verify-ai-keys / verify-c5-timeline /
   verify-c7-references / verify-d-routing / verify-d-tools /
   verify-e-cron / verify-milestone-b / verify-milestone-e /
   verify-pages / verify-space-purge          （11 支不在 CI）
```

`verify-account-delete` 與 `verify-space-purge` 這兩支特別值得注意——
帳號刪除與空間清除是**做錯了會留下別人資料**的操作，
而驗證它們的腳本只在有人記得手動跑的時候跑。

一支沒有在 CI 跑的驗證腳本，等於一份寫在 `scripts/` 裡的希望。

### 3. 62 份 migration，但沒有東西在問「這些表有沒有人在用」

`check:rls` 問的是「每張表有沒有 RLS」——那是**安全**的問題。
沒有任何東西問**接線**的問題：

```text
這張表建好了，有沒有任何一行程式在讀它或寫它
這個欄位有沒有任何一行程式在讀它
```

1page 0815 才發現三張表（invoices / invoice_lines / payments）
從 migration 跑完之後一行程式碼都沒有，而稽核每天回報「沒有問題」——
因為它用整份原始碼做子字串比對，`invoices.number` 被
`typeof x === "number"` 裡的 `number` 命中了。

**兩層，順序有意義**：

```text
表級（先做）    from('<表名>') 從來沒出現過 = migration 跑了但功能沒做。
                這一層抓到的東西最大
欄位級（後做）  只在「有提到那張表的檔案」裡找，而且**整字比對**。
                全域子字串比對是假的
```

⚠️ 比對原始碼之前**要先去掉註解**。1page 因為同一個原因
造成過一次假通過、一次假失敗。

---

## 三、⚠️ 一件與 SnowRealm-Platform 有關的事

`docs/` 底下已經有 `SnowRealm-Platform-Planning.md`、
`SnowRealm-SDK-vs-Platform.md`、`ecosystem-strategy.md`、`platform.md`。
也就是說：**整個品牌的平台規劃目前住在這個專案裡**。

那不是壞事（它是最成熟的一個，規劃長在這裡很自然），但它會造成一個問題：
另外七個專案讀不到那些決定，於是各做各的。

**建議**：那幾份移到 `SnowRealm-Platform/docs/`（或至少同步一份過去），
這個專案只留一份指過去的連結。理由是那些文件的讀者
**不是這個專案的開發者**，是其他七個專案的開發者。

⚠️ 抽 SDK 的判準（這件事在 `SnowRealm-SDK-vs-Platform.md` 裡要寫死）：
**已經在兩個以上專案裡各寫過一次、而且寫法一樣**。
只寫過一次的東西抽出來只會變成一個沒有人敢改的套件。

以這個標準，目前真的合格的只有三樣：

```text
自架 GoTrue 的接法          這裡與 1page 是同一套
presign 直傳 R2 + 進度      這裡 / 1page / ai_island 各寫過一次
「反過來問」型的接線稽核      ⚠️ 目前只有 1page 有 → **還不合格**，
                            但每個專案都需要。先在這裡也寫一次，
                            兩次之後再談抽出來
```

---

## 四、不建議做的事

```text
❌ 再加檢查腳本               `scripts/` 已經有 34 支，其中 12 支是 verify-*，
                             而只有 1 支在 CI 裡跑（見上面 2b）。
                             再加只會讓「哪些真的在跑」更難說清楚。
                             先把既有的 11 支接進 CI，或者刪掉不再需要的

❌ 拆更多 package             13 個已經接近人腦能記住的上限，
                             而且 dependency-cruiser 顯示引用數分布健康
                             （最少的 weather 也有 5 處）。沒有孤兒 package

❌ 追測試覆蓋率數字            75 個測試檔涵蓋的面向（RLS / a11y / visual /
                             e2e / mobile）比覆蓋率百分比有意義得多。
                             缺的是**種類**（CSP、路由可達性、接線），不是數量

❌ 現在動 auth 去接 SSO       見下面
```

---

## 五、⚠️ SSO 動工前必須先決定的一件事

1page 那邊已經撞到，記在這裡免得重蹈：

R2 自訂網域與站台**同註冊網域**時，一旦把 auth cookie 設成
`Domain=.snowrealm.pet`，那個媒體網域**也會收到 auth cookie**——
而媒體網域上的內容是使用者上傳的。一個惡意 SVG 被直接開啟時就讀得到它。

目前 Supabase 的 cookie 是 host-only，所以還安全。
**做 SSO 的那一刻這件事會第一個撞上來。**

三個選項，趁媒體記錄還少的時候決定：

```text
A. 什麼都不做，靠 SVG 不進白名單 + Content-Type 鎖死
   → 把安全性押在一個未來的決定上
B. SSO cookie 用更窄的 Domain
   → 可行，但 GoTrue 那側要客製，每加一個產品都要改
C. 媒體換到 SSO cookie 範圍外的網域
   → 一次解決。趁現在做成本最低
```

---

## 六、順序

```text
第一步   CSP + 一支驗「真的送出去了」的稽核，加完實測一次媒體上傳
第二步   verify-pages 的清單改成從磁碟列舉，並接進 CI
第三步   其餘 10 支 verify-* 逐一決定：接進 CI，或刪掉
第四步   路由可達性（從首頁點得到嗎），與第二步的「打得開嗎」是兩件事
第五步   表級接線稽核
之後     平台文件搬家、SSO 的網域決定
```

第一步是唯一一件「現在完全沒有」的；其餘三件都是把既有的好習慣
再延伸一格。
