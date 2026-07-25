-- 0046_capture_inbox.sql
-- 隨手捕捉 inbox：任何時候把一個念頭丟進來，之後再沉澱（轉成筆記/封存）。
-- 這是 YukiBoard「隨處捕捉 → 沉澱進空間」的落點：外部來源（鍵盤/agent）也能寫進來。
-- 使用者輸入的文字（非上傳檔案）→ 專用表，不違反 ADR-005。授權一律 space_id（ADR-006）。

create table if not exists capture_inbox (
  id         uuid primary key default gen_random_uuid(),
  space_id   uuid not null references spaces(id) on delete cascade,
  body       text not null,
  source     text not null default 'web',   -- web / yukiboard / agent
  status     text not null default 'inbox' check (status in ('inbox','archived','converted')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists capture_inbox_space_idx
  on capture_inbox (space_id, status, created_at desc);

alter table capture_inbox enable row level security;
drop policy if exists "member manages captures" on capture_inbox;
create policy "member manages captures" on capture_inbox
  for all using (is_space_member(space_id)) with check (is_space_member(space_id));
