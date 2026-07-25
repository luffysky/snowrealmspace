-- 0045_mood_goals.sql
-- 兩個新 widget 的資料表：mood_checkin（每日心情）與 goal_tracker（目標）。
-- 都是使用者輸入的結構化資料（非上傳檔案）→ 專用表，不違反 ADR-005。
-- 授權一律 space_id（ADR-006），RLS 成員可讀寫自己 space 的。

-- ── 每日心情打卡：一個 space 一天一筆（覆寫式）──
create table if not exists mood_entries (
  space_id   uuid not null references spaces(id) on delete cascade,
  local_date date not null,
  mood       text not null check (mood in ('great','good','ok','low','rough')),
  note       text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (space_id, local_date)
);
create index if not exists mood_entries_space_idx on mood_entries (space_id, local_date desc);

alter table mood_entries enable row level security;
drop policy if exists "member manages mood" on mood_entries;
create policy "member manages mood" on mood_entries
  for all using (is_space_member(space_id)) with check (is_space_member(space_id));

drop trigger if exists mood_entries_touch on mood_entries;
create trigger mood_entries_touch before update on mood_entries
  for each row execute function public.touch_updated_at();

-- ── 目標追蹤 ──
create table if not exists goals (
  id         uuid primary key default gen_random_uuid(),
  space_id   uuid not null references spaces(id) on delete cascade,
  title      text not null,
  target     integer not null default 1 check (target >= 1),
  current    integer not null default 0 check (current >= 0),
  unit       text not null default '',
  done       boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists goals_space_idx
  on goals (space_id, created_at desc) where deleted_at is null;

alter table goals enable row level security;
drop policy if exists "member manages goals" on goals;
create policy "member manages goals" on goals
  for all using (is_space_member(space_id)) with check (is_space_member(space_id));

drop trigger if exists goals_touch on goals;
create trigger goals_touch before update on goals
  for each row execute function public.touch_updated_at();
