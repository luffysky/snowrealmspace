-- 0001_extensions.sql
-- 見 docs/spec/03-database.md §1

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";
-- pgvector 在 Milestone D（記憶檢索）才用得到，但先裝好避免屆時再改 migration
create extension if not exists "vector";

-- updated_at 自動維護（§12）
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
