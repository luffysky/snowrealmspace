-- 0019_asset_metadata.sql
-- Milestone C — Creative Library 的整理欄位。
--
-- assets 的「不可變」只約束位元組事實（storage_key/checksum/bytes/mime_type，
-- 見 02-domain-model.md §8.3）。收藏、封存、標籤是整理用的 metadata，可變。
--
-- 為什麼放在 assets 而非只放 design_files.tags：
--   Library 直接操作的是「檔案」(asset)。使用者要能對任何上傳檔案收藏/封存/貼標，
--   不必先把它升格成「作品」(design_file)。作品層另有自己的 tags（創作用途）。

alter table assets add column if not exists is_favorite boolean not null default false;
alter table assets add column if not exists archived_at timestamptz;
alter table assets add column if not exists tags text[] not null default '{}';

-- 篩選：收藏牆、標籤過濾
create index if not exists assets_space_favorite_idx
  on assets (space_id) where is_favorite and deleted_at is null;
create index if not exists assets_tags_idx on assets using gin (tags);

-- 搜尋：pg_trgm 對檔名做模糊比對（Creative Library 的 pg_trgm 搜尋需求）
create index if not exists assets_filename_trgm_idx
  on assets using gin (original_filename gin_trgm_ops);
