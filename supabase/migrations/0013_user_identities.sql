-- 第三方登入身分。實作 13-third-party-auth.md §3.1。
--
-- 為什麼不直接用 auth.identities：
--   1. 它是 Supabase 的內部表，schema 可能隨版本變動
--   2. LINE 走自建流程，根本不會出現在 auth.identities
--   3. 我們需要加自己的欄位（line_user_id 用於未來發通知）
-- 這張表是**投影**：Google 的部分由 auth.identities 同步過來，
-- LINE 的部分由我們自己的 callback 寫入。

create table if not exists user_identities (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,

  provider     text not null check (provider in ('email', 'google', 'line')),
  -- Google 的 sub / LINE 的 userId / email 身分則存 email 本身
  provider_uid text not null,

  email        text,                  -- provider 回報的 email，LINE 可能為 null
  display_name text,
  avatar_url   text,

  -- LINE 專用。與 provider_uid 同值，但獨立成欄位是為了
  -- 未來發通知時能直接 join，不必判斷 provider。
  line_user_id text,

  linked_at    timestamptz not null default now(),
  last_used_at timestamptz,

  -- 這條約束是整張表的重點：
  -- 讓「同一個 Google/LINE 帳號被綁到兩個 SnowRealm 帳號」
  -- 在資料庫層就不可能發生，不必依賴應用層檢查。
  unique (provider, provider_uid)
);

create index if not exists user_identities_user_id_idx on user_identities (user_id);
create index if not exists user_identities_line_user_id_idx
  on user_identities (line_user_id) where line_user_id is not null;

alter table user_identities enable row level security;

-- 只能看自己的。寫入一律走 service role（OAuth callback 在使用者
-- 尚未有 session 的狀態下也要能寫）。
drop policy if exists "own identities" on user_identities;
create policy "own identities" on user_identities
  for select using (user_id = auth.uid());

drop trigger if exists user_identities_touch on user_identities;

-- 0007_grants.sql 的 GRANT 只涵蓋當時存在的表，新表要自己補。
grant select on user_identities to authenticated;
grant all    on user_identities to service_role;

-- ── LINE 登入用的一次性 nonce ────────────────────────────────
-- 自建 OAuth 流程必須驗證 state 與 nonce（13-third-party-auth.md §2.1
-- 明列這三項不可省略）。存 DB 而非只存 cookie 的理由：
-- cookie 可被使用者竄改，DB 這一份是權威來源，且能保證「只能用一次」。
create table if not exists oauth_transactions (
  state        text primary key,
  nonce        text not null,
  provider     text not null check (provider in ('line')),
  -- 'link' = 綁定到既有帳號（需要 user_id）；'login' = 用已綁定的身分登入
  intent       text not null check (intent in ('link', 'login')),
  user_id      uuid references auth.users(id) on delete cascade,
  redirect_to  text,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '10 minutes',
  consumed_at  timestamptz
);

create index if not exists oauth_transactions_expires_at_idx
  on oauth_transactions (expires_at);

alter table oauth_transactions enable row level security;
-- 沒有任何 policy：這張表只有 service role 能碰。
-- 使用者不該讀到別人的 state，自己的也不需要讀。

grant all on oauth_transactions to service_role;
