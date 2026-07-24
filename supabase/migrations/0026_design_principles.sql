-- 0026_design_principles.sql
-- 設計原則：使用者記錄自己的創作準則／設計價值觀（Luffy 追加）。
-- 這是「空間累積主人樣貌」的一部分 —— 使用者的原則會進入 Agent context，
-- 讓評論與建議貼合這個人的品味，而不是通用套話。

create table if not exists design_principles (
  id       uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,

  title    text not null,
  body     text,
  category text,                       -- 可選分類：排版／配色／留白／字體…
  position integer not null default 0, -- 排序

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists design_principles_space_idx
  on design_principles (space_id, position) where deleted_at is null;

drop trigger if exists design_principles_touch on design_principles;
create trigger design_principles_touch before update on design_principles
  for each row execute function public.touch_updated_at();

alter table design_principles enable row level security;

drop policy if exists "member manages principles" on design_principles;
create policy "member manages principles" on design_principles
  for all using (is_space_member(space_id)) with check (is_space_member(space_id));

grant select, insert, update, delete on design_principles to authenticated;
grant all on design_principles to service_role;
