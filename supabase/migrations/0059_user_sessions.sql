-- 0059_user_sessions.sql
-- 使用者「上線工作階段」——後台使用者管理顯示：上線時間 / 時長 / 何時上 / 地區 / 裝置。
-- 參考 AI 島 analytics_sessions，但**不存原始 IP**：只存 IP 雜湊 + 在capture當下換好的地區字串。
--
-- 非 space 綁定（站台層級，跨空間看整個站的使用者），故不帶 space_id：
--   RLS 改用「站台管理員可讀」；寫入一律走 service role（heartbeat / 登入捕捉）。
-- 冪等：create ... if not exists / drop policy if exists（本 runner 會重跑，見 scripts/migrate.ts）。

create table if not exists user_sessions (
  id            text primary key,                       -- client 端產生的 session id
  user_id       uuid references auth.users(id) on delete cascade,

  started_at    timestamptz not null default now(),     -- 這次上線起點
  last_seen_at  timestamptz not null default now(),     -- 最後心跳（判斷是否在線）
  ended_at      timestamptz,                            -- page_exit / 逾時

  ip_hash       text,                                   -- 雜湊，非明文 IP（同 audit_logs 慣例）
  country       text,                                   -- 於 capture 當下由 IP 換得，不存原始 IP
  region        text,
  city          text,

  device_type   text,                                   -- mobile / tablet / desktop
  browser       text,
  os            text,

  current_path  text,
  page_count    integer not null default 1,
  total_duration_sec integer not null default 0,        -- 累計在線秒數（心跳累加、上限夾住）

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists user_sessions_user_idx on user_sessions (user_id);
create index if not exists user_sessions_last_seen_idx on user_sessions (last_seen_at desc);

alter table user_sessions enable row level security;

-- 站台管理員（profiles.site_role ∈ owner/admin）可讀；一般使用者讀不到自己以外的資料。
drop policy if exists "site admin reads user_sessions" on user_sessions;
create policy "site admin reads user_sessions" on user_sessions
  for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.site_role in ('owner', 'admin')
    )
  );

-- 寫入沒有 RLS policy → 只有 service role（bypass RLS）能寫（heartbeat / 登入捕捉）。
grant select on user_sessions to authenticated;
grant all on user_sessions to service_role;
