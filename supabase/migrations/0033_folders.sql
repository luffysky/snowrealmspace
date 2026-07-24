-- 0033 Library 資料夾（Luffy 追加）
--
-- 扁平資料夾：把 asset 歸類到具名資料夾。刪資料夾**不刪檔案**（folder_id → set null，
-- 檔案回到「未分類」）。folder_id 屬於 asset 的中繼資料（可變），與 0019 的
-- is_favorite/archived_at/tags 同性質——不違反 ADR-005「位元組不可變」。

create table if not exists folders (
  id         uuid primary key default gen_random_uuid(),
  space_id   uuid not null references spaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name       text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists folders_space_idx on folders (space_id) where deleted_at is null;

alter table folders enable row level security;

-- 照 assets 的 policy 模式（0008）：成員可讀/建/改，授權一律走 space_id（ADR-006）
drop policy if exists "member reads folders" on folders;
create policy "member reads folders" on folders
  for select using (is_space_member(space_id) and deleted_at is null);

drop policy if exists "member creates folders" on folders;
create policy "member creates folders" on folders
  for insert with check (is_space_member(space_id));

drop policy if exists "member updates folders" on folders;
create policy "member updates folders" on folders
  for update using (is_space_member(space_id)) with check (is_space_member(space_id));

-- asset 歸屬資料夾。刪資料夾 → 檔案回到未分類（不刪檔）。
alter table assets add column if not exists folder_id uuid references folders(id) on delete set null;
create index if not exists assets_folder_idx on assets (folder_id) where deleted_at is null;
