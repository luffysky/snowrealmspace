# 第三方登入 — Google / LINE

> 規劃文件。**Milestone A 不實作**（ADR-003 決定 Alpha 只做 magic link）。
> 這份寫在前面的理由：第三方登入會影響 `profiles` 的欄位、帳號合併策略與邀請閘門的位置，
> 事後補做的成本遠高於先想清楚。實作排在 **V1**。

---

## 1. 為什麼要加，以及為什麼不是現在

**要加的理由**
- Magic link 的體感成本比想像高：切換到信箱、等信、回來。對「每天回訪」的產品（v1.0 §7.1）這是每日摩擦。
- LINE 在台灣是主要通訊工具，對本產品的目標使用者（v1.0 §6）而言是最自然的身分。
- 未來若要做 LINE 通知（v1.0 §28.2 的 Messaging App channel），登入時取得的 LINE user id 是前置條件。

**不是現在的理由**
- Google 與 LINE 都需要**已上線的網域與隱私權政策頁**才能通過審核。Alpha 階段兩者都還不存在。
- 邀請制（ADR-003）與第三方登入的組合有一個非顯而易見的陷阱（見 §4），現在做會在沒有真實使用者的情況下浪費時間在邊界情況上。
- Milestone A 的閉環不需要它。

---

## 2. Provider 對照

| | Google | LINE |
|---|---|---|
| Supabase 原生支援 | ✅ 內建 | ❌ **不支援** |
| 協定 | OIDC | OIDC（LINE Login v2.1） |
| 取得 email | ✅ 一定有 | ⚠️ **需額外申請 email 權限，且使用者可拒絕** |
| 帳號審核 | 需要（OAuth consent screen） | 需要（LINE Developers Console） |
| 台灣使用者覆蓋 | 高 | 很高 |
| 額外價值 | — | 可串 LINE 通知 |

### 2.1 LINE 不被 Supabase 原生支援 — 兩條路

**路線 A：Supabase 的 Generic OIDC（若當時版本支援）**
最省事，但 LINE 的 OIDC 實作有幾處非標準（`id_token` 的 `amr`、email 需額外 scope），需要實測。

**路線 B：自建 OAuth 流程 + `signInWithIdToken`**（**建議**）
```
/api/auth/line/start
  → 產生 state + nonce（存 httpOnly cookie）
  → 導向 https://access.line.me/oauth2/v2.1/authorize
      client_id / redirect_uri / state / nonce
      scope=openid profile email

/api/auth/line/callback
  → 驗證 state（防 CSRF）
  → 以 code 換 token：POST https://api.line.me/oauth2/v2.1/token
  → 驗證 id_token 簽章與 nonce
  → supabase.auth.signInWithIdToken({ provider: 'oidc', token: id_token })
```

路線 B 的好處是我們掌握完整流程，不受 Supabase 對 LINE 支援程度的限制。代價是要自己處理 state/nonce/簽章驗證——這三項都不可省略。

---

## 3. 資料模型變更

### 3.1 新增 `user_identities`

Supabase 的 `auth.identities` 已記錄 provider 綁定，但我們需要一份**自己可查詢、可加欄位**的投影，用於：
- 顯示「已連結的登入方式」設定頁
- 存 LINE user id（未來發通知用）
- 記錄綁定/解綁的稽核

```sql
-- 0100_third_party_auth.sql（V1）
create table user_identities (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,

  provider     text not null check (provider in ('email','google','line')),
  provider_uid text not null,          -- Google sub / LINE userId

  email        text,                   -- provider 回報的 email，可能為 null（LINE）
  display_name text,
  avatar_url   text,

  -- LINE 專用：發通知需要，且與登入身分是同一個值
  line_user_id text,

  linked_at    timestamptz not null default now(),
  last_used_at timestamptz,

  unique (provider, provider_uid)
);
create index on user_identities (user_id);

alter table user_identities enable row level security;

create policy "own identities" on user_identities
  for select using (user_id = auth.uid());
-- 寫入一律走 service role（OAuth callback）
```

`unique (provider, provider_uid)` 是關鍵：它讓「同一個 Google 帳號被綁到兩個 SnowRealm 帳號」在資料庫層就不可能發生。

### 3.2 `profiles` 不變

刻意不在 `profiles` 加 provider 欄位。一個使用者可以同時綁 email + Google + LINE，那是一對多關係，塞進 `profiles` 會立刻需要重構。

---

## 4. 邀請閘門的位置（最容易做錯的地方）

ADR-003 的邀請制與第三方登入組合起來有個陷阱：

> **Google/LINE 登入會直接建立 `auth.users`，繞過我們的邀請檢查。**

magic link 流程中，我們在 `/auth/callback` 檢查邀請，未通過就 `signOut()`。但那時 `auth.users` 已經建立了——只是沒有 space。第三方登入同理，而且更容易被大量觸發（任何人點一下 Google 登入就產生一筆 user）。

### 決策：閘門仍在 callback，但加上清理

```
/api/auth/{provider}/callback
  1. 驗證 state / nonce
  2. 換 token、驗 id_token
  3. signInWithIdToken → 取得 user
  4. 已是某 space 成員？→ 放行
  5. 否 → 檢查 invite token（從 cookie 取，登入前就存好）
       ├─ 有效 → 佈建 space（與 magic link 共用 provisionSpaceForUser）
       └─ 無效 → signOut()
                 + 若這個 auth.users 是本次新建且無任何 space
                   → 排入 orphan-user 清理（延遲 1 小時，避免競態）
```

**invite token 必須在導向 provider 之前就存進 httpOnly cookie**，因為 OAuth 回來時 URL 只有 provider 給的參數。這一點與 magic link 不同（magic link 可以把 invite 塞進 `emailRedirectTo`）。

### 孤兒使用者清理

新增 cron：`/api/cron/orphan-user-gc`，每日清除「建立超過 24 小時、不屬於任何 space、且無 `space_invites` 待接受」的 `auth.users`。這是防濫用機制，不是可有可無的整理。

---

## 5. 帳號合併

**情境：** 使用者先用 `nami@gmail.com` magic link 註冊，後來用 Google 登入同一個 email。

Supabase 預設行為受 `auth.email.enable_confirmations` 與 provider 的 email 驗證狀態影響。**不可依賴預設行為**——必須明確決定。

### 決策：只在 provider 已驗證 email 時自動合併

| 情況 | 行為 |
|---|---|
| Google（email 已驗證）+ 既有同 email 帳號 | **自動合併**，新增一筆 `user_identities` |
| LINE 有提供 email 且已驗證 | 同上 |
| LINE 未提供 email | **不合併**，視為獨立新帳號 |
| provider email 未驗證 | **不合併**，且拒絕登入並說明原因 |

未驗證 email 的自動合併是帳號接管漏洞：攻擊者在 provider 端註冊一個聲稱是受害者 email 的帳號，就能登入受害者的 space。

### 在設定頁提供手動綁定

`/settings/account` 顯示已連結的登入方式，並可主動綁定/解綁。**解綁時必須確保至少保留一種登入方式**，否則使用者會把自己鎖在外面。

---

## 6. LINE 的 email 問題

LINE 的 email 需要在 LINE Developers Console 額外申請（要提交用途說明），且**使用者在授權畫面可以拒絕提供**。

因此流程必須能處理「沒有 email 的使用者」：

- `auth.users.email` 可為 null → 我們的程式碼不可假設 email 一定存在
- `provisionSpaceForUser` 目前用 `email.split('@')[0]` 當預設名稱 → **必須改**，改用 LINE 的 `displayName`
- 邀請制以 email 比對 → LINE 使用者若無 email，**無法透過現行邀請流程進入**

**決策：** LINE 登入在 Alpha/V1 期間**只支援「已有帳號者登入」，不支援註冊**。新使用者仍須走 email 邀請。等到開放公開註冊時再處理無 email 的情況。

這個限制必須在 UI 上說清楚，而不是讓使用者點了 LINE 之後才發現進不去。

---

## 7. UI

登入頁的順序刻意把 email 放在最前面——它是 Alpha 期間唯一能完成註冊的方式：

```
┌────────────────────────────────┐
│  SnowRealm Space               │
│                                │
│  Email                         │
│  [                          ]  │
│  [      寄送登入連結        ]  │
│                                │
│  ──────── 或使用 ────────      │
│                                │
│  [  以 Google 繼續          ]  │
│  [  以 LINE 繼續            ]  │
│                                │
│  目前為邀請制。LINE 與 Google  │
│  僅供已有帳號者登入。          │
└────────────────────────────────┘
```

**無障礙要求（ADR-011）**
- 第三方登入按鈕不可只有品牌圖示，必須有文字標籤
- 品牌色若對比不足，需加邊框（LINE 綠 `#06C755` 對白底約 2.4:1，作為背景色時文字必須是白色）
- 按鈕最小點擊區域 44×44（WCAG 2.2 target size）

---

## 8. 環境變數

```bash
# Google（Supabase 原生，設在 Dashboard；本機設在 config.toml）
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=

# LINE（自建流程）
LINE_LOGIN_CHANNEL_ID=
LINE_LOGIN_CHANNEL_SECRET=
LINE_LOGIN_REDIRECT_URI=      # 必須與 LINE Console 完全一致
```

本機 `supabase/config.toml`：
```toml
[auth.external.google]
enabled = true
client_id = "env(GOOGLE_OAUTH_CLIENT_ID)"
secret = "env(GOOGLE_OAUTH_CLIENT_SECRET)"
redirect_uri = "http://127.0.0.1:54321/auth/v1/callback"
```

---

## 9. 上線前檢查清單

**Google**
- [ ] OAuth consent screen 填寫完成並通過審核
- [ ] 授權網域已驗證
- [ ] Redirect URI 同時包含 production 與 preview 網域
- [ ] scope 最小化：只要 `openid email profile`，**不要**要求 Drive 等額外權限

**LINE**
- [ ] LINE Login channel 建立
- [ ] Callback URL 完全一致（LINE 對此極嚴格，多一個斜線就失敗）
- [ ] email 權限已申請（若需要）
- [ ] 已測試使用者拒絕提供 email 的路徑

**共同**
- [ ] 隱私權政策頁已上線（兩家審核都要求）
- [ ] state 驗證（防 CSRF）
- [ ] nonce 驗證（防 id_token 重放）
- [ ] id_token 簽章驗證（對 provider 的 JWKS）
- [ ] 孤兒使用者 GC cron 已部署
- [ ] 帳號合併只在 email 已驗證時發生
- [ ] 解綁時保證至少剩一種登入方式
- [ ] E2E 涵蓋：新使用者被邀請閘門擋下、既有使用者成功登入、解綁最後一個 provider 被拒絕

---

## 10. 驗收條件

```gherkin
Feature: 第三方登入

  Scenario: 未受邀者用 Google 登入無法取得空間
    Given 某 email 沒有有效邀請
    When 使用者以該 Google 帳號登入
    Then 不會建立任何 space
    And 使用者被登出並看到邀請制說明
    And 該 auth.users 在 24 小時後被 GC 清除

  Scenario: 既有使用者綁定 Google 後可用兩種方式登入
    Given 使用者已用 magic link 建立空間
    When 使用者在設定頁綁定同一 email 的 Google 帳號
    Then user_identities 有兩筆紀錄
    And 之後用任一方式登入都進到同一個 space

  Scenario: 未驗證 email 不自動合併
    Given provider 回報的 email 未驗證
    When 該 email 已存在於系統
    Then 登入被拒絕
    And 顯示「請改用原本的登入方式」

  Scenario: LINE 未提供 email 的新使用者
    Given 使用者以 LINE 登入且拒絕提供 email
    And 該 LINE 帳號未綁定任何既有使用者
    Then 明確告知目前為邀請制、需以 email 進入
    And 不建立 space

  Scenario: 不能解綁最後一種登入方式
    Given 使用者只綁定了 Google
    When 使用者嘗試解綁 Google
    Then 操作被拒絕並說明原因
```

---

## 11. 排期

| 階段 | 內容 |
|---|---|
| **Milestone A–E** | 不做。只有 magic link |
| **V1 前置** | 網域上線、隱私權政策頁、`user_identities` migration |
| **V1** | Google 登入（Supabase 原生，成本低） |
| **V1.1** | LINE 登入（自建流程） |
| **V2** | LINE 通知 channel（複用登入時取得的 line_user_id） |

先做 Google 的理由：Supabase 原生支援，可用來驗證「邀請閘門 + 帳號合併 + 孤兒 GC」這三個機制。這些機制在 LINE 上是一樣的，等 Google 跑順了再接 LINE，風險小得多。
