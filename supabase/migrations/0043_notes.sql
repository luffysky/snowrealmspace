-- 0043_notes.sql
-- 一般筆記（Agent 的 create_note 工具寫這裡；也可當未來的筆記功能後端）。
-- 與 widget_notes（隨手記，綁 widget instance）不同：這是獨立、可歸屬專案的筆記。

create table if not exists notes (
  id         uuid primary key default gen_random_uuid(),
  space_id   uuid not null references spaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  title      text,
  body       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists notes_space_idx on notes (space_id, created_at desc) where deleted_at is null;
create index if not exists notes_project_idx on notes (project_id) where deleted_at is null;

alter table notes enable row level security;

drop policy if exists "member manages note rows" on notes;
create policy "member manages note rows" on notes
  for all using (is_space_member(space_id)) with check (is_space_member(space_id));

drop trigger if exists notes_touch on notes;
create trigger notes_touch before update on notes
  for each row execute function public.touch_updated_at();
