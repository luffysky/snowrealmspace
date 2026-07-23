-- 0008_assets.sql
-- ADR-005：assets 是位元組的唯一真相。不可變。
-- 見 docs/spec/02-domain-model.md §3.1、03-database.md §3

create table if not exists assets (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references spaces(id) on delete cascade,
  created_by  uuid references auth.users(id) on delete set null,

  kind        text not null check (kind in ('image','video','pdf','audio','font','document')),
  mime_type   text not null,
  bytes       bigint not null check (bytes > 0),
  checksum    text not null,
  storage_key text not null unique,

  original_filename text,
  width       integer,
  height      integer,
  duration_ms integer,

  status         text not null default 'pending'
                   check (status in ('pending','ready','failed')),
  failure_reason text,

  -- 本地分析結果（ADR-012）。由 asset.analyze_local job 回填。
  -- 只放可計算、可重現的數值 —— Vision 的主觀判讀存在別處。
  local_features jsonb not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint assets_bytes_limit check (bytes <= 52428800)   -- 50 MB 硬上限（ADR-022）
);

-- 同 space 去重：相同內容不重複佔用空間與縮圖生成成本。
-- 跨 space 不去重 —— 那會讓人能推斷出別人有哪些檔案。
create unique index if not exists assets_space_checksum_uq
  on assets (space_id, checksum)
  where deleted_at is null and status = 'ready';

create index if not exists assets_space_created_idx
  on assets (space_id, created_at desc) where deleted_at is null;
create index if not exists assets_space_kind_idx
  on assets (space_id, kind) where deleted_at is null;
create index if not exists assets_pending_idx
  on assets (created_at) where status = 'pending';
create index if not exists assets_deleted_idx
  on assets (deleted_at) where deleted_at is not null;

create table if not exists asset_renditions (
  id       uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets(id) on delete cascade,
  space_id uuid not null references spaces(id) on delete cascade,

  role text not null
    check (role in ('thumbnail','preview','poster','transcode_720','transcode_1080')),
  mime_type   text not null,
  bytes       bigint not null,
  storage_key text not null unique,
  width       integer,
  height      integer,

  created_at timestamptz not null default now(),
  unique (asset_id, role)
);
create index if not exists asset_renditions_space_idx on asset_renditions (space_id);

-- 補上 0002 預留的 FK（當時 assets 尚未存在）
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'agent_profiles_avatar_fk'
  ) then
    alter table agent_profiles
      add constraint agent_profiles_avatar_fk
      foreign key (avatar_asset_id) references assets(id) on delete set null;
  end if;
end $$;

/*
 * 配額計算（ADR-022：每個 space 5 GB）。
 * 放在 DB 函式而非應用層，避免併發上傳各自讀到舊值而一起通過檢查。
 */
create or replace function public.space_storage_bytes(target_space_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((select sum(bytes) from assets
              where space_id = target_space_id and deleted_at is null), 0)
  + coalesce((select sum(r.bytes) from asset_renditions r
              join assets a on a.id = r.asset_id
              where r.space_id = target_space_id and a.deleted_at is null), 0);
$$;

revoke all on function public.space_storage_bytes(uuid) from public;
grant execute on function public.space_storage_bytes(uuid) to authenticated;

alter table assets           enable row level security;
alter table asset_renditions enable row level security;

drop policy if exists "member reads assets" on assets;
create policy "member reads assets" on assets
  for select using (is_space_member(space_id) and deleted_at is null);

drop policy if exists "member creates assets" on assets;
create policy "member creates assets" on assets
  for insert with check (is_space_member(space_id));

drop policy if exists "member updates assets" on assets;
create policy "member updates assets" on assets
  for update using (is_space_member(space_id)) with check (is_space_member(space_id));

-- 衍生檔由 worker 產生。使用者不該能偽造，因此只開 SELECT。
drop policy if exists "member reads renditions" on asset_renditions;
create policy "member reads renditions" on asset_renditions
  for select using (is_space_member(space_id));

create trigger assets_touch before update on assets
  for each row execute function public.touch_updated_at();
