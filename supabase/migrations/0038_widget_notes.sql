-- 0038_widget_notes.sql
-- 隨手記從 localStorage 改存 DB（跨裝置可見）。
-- 一個 quick_note widget instance 對一則筆記；instance 刪除連帶清掉。
-- 這是文字內容，不是使用者上傳的檔案 → 存專用表，不違反 ADR-005（位元組只存 assets）。

create table if not exists widget_notes (
  instance_id uuid primary key references widget_instances(id) on delete cascade,
  space_id    uuid not null references spaces(id) on delete cascade,
  body        text not null default '',
  updated_at  timestamptz not null default now()
);
create index if not exists widget_notes_space_idx on widget_notes (space_id);

alter table widget_notes enable row level security;

-- 授權一律用 space_id（ADR-006）。成員可讀寫自己 space 的筆記。
drop policy if exists "member manages notes" on widget_notes;
create policy "member manages notes" on widget_notes
  for all using (is_space_member(space_id)) with check (is_space_member(space_id));

-- Postgres 沒有 create trigger if not exists，先 drop 保持冪等。
drop trigger if exists widget_notes_touch on widget_notes;
create trigger widget_notes_touch before update on widget_notes
  for each row execute function public.touch_updated_at();
