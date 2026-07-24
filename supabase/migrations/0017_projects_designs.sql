-- 0017_projects_designs.sql
-- Milestone C — Creative Core 的資料地基。
-- 見 docs/spec/02-domain-model.md §3、03-database.md §7。
--
-- 模型核心：assets 是位元組的唯一真相（不可變）；design_files 是「作品」
-- 這個創作單元（不存位元組）；design_snapshots 是作品的某個版本，用 asset_id
-- 指向該版本的畫面 —— 這是「版本比較」能成立的關鍵連結。
--
-- design_connections / provider_webhooks 是 Milestone F（Figma 同步）才會用到，
-- 但 design_files.connection_id 的 FK 依賴它，且 spec 將它們同組建立，故一併建表
-- （僅 schema 與 RLS，無任何 F 功能與 API）。

create table if not exists projects (
  id       uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,

  name        text not null,
  description text,
  status      text not null default 'idea'
                check (status in ('idea','active','paused','completed','archived')),
  cover_asset_id uuid references assets(id) on delete set null,
  tags        text[] not null default '{}',

  last_activity_at timestamptz not null default now(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists projects_space_status_idx
  on projects (space_id, status, last_activity_at desc) where deleted_at is null;
create index if not exists projects_tags_idx on projects using gin (tags);

create table if not exists design_connections (
  id        uuid primary key default gen_random_uuid(),
  space_id  uuid not null references spaces(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,

  provider  text not null check (provider in ('figma','canva','adobe_express','photoshop','other')),
  external_account_id text,
  external_account_label text,

  access_token_encrypted  text,
  refresh_token_encrypted text,
  scopes    text[] not null default '{}',
  expires_at timestamptz,

  status    text not null default 'active'
              check (status in ('active','expired','revoked','error')),
  last_synced_at timestamptz,
  last_error text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (space_id, provider, external_account_id)
);

create table if not exists design_files (
  id       uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,

  provider    text not null default 'upload'
                check (provider in ('upload','figma','canva','adobe','other')),
  connection_id uuid references design_connections(id) on delete set null,
  external_id text,

  title       text not null,
  description text,
  source_url  text,               -- 外部連結（非檔案 URL）
  project_id  uuid references projects(id) on delete set null,
  tags        text[] not null default '{}',

  sync_status text not null default 'manual'
                check (sync_status in ('manual','active','paused','error')),
  last_synced_at timestamptz,
  last_error  text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  -- 外部 provider 必須有 connection 與 external_id
  constraint df_external_check check (
    provider = 'upload' or (connection_id is not null and external_id is not null)
  )
);
create index if not exists design_files_space_updated_idx
  on design_files (space_id, updated_at desc) where deleted_at is null;
create index if not exists design_files_project_idx
  on design_files (project_id) where deleted_at is null;
create index if not exists design_files_tags_idx on design_files using gin (tags);
create unique index if not exists design_files_conn_external_uq
  on design_files (connection_id, external_id)
  where provider <> 'upload' and deleted_at is null;

create table if not exists design_snapshots (
  id             uuid primary key default gen_random_uuid(),
  space_id       uuid not null references spaces(id) on delete cascade,
  design_file_id uuid not null references design_files(id) on delete cascade,

  -- on delete restrict：DB 層直接強制「刪除 asset 前必須檢查引用」
  -- （02-domain-model.md §5.4），不靠應用層記得檢查。
  asset_id       uuid not null references assets(id) on delete restrict,
  document_asset_id uuid references assets(id) on delete set null,
  external_version_id text,

  extracted_features jsonb not null default '{}',   -- 本地分析（ADR-012）
  vision_features    jsonb not null default '{}',   -- Vision 分析，含 confidence
  checksum       text not null,

  created_at     timestamptz not null default now(),
  unique (design_file_id, checksum)
);
create index if not exists design_snapshots_file_created_idx
  on design_snapshots (design_file_id, created_at desc);
create index if not exists design_snapshots_space_idx on design_snapshots (space_id);

create table if not exists design_insights (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references spaces(id) on delete cascade,
  snapshot_id uuid references design_snapshots(id) on delete cascade,

  kind        text not null,        -- 'analysis' | 'comparison' | 'suggestion'
  statements  jsonb not null default '[]',
  /* [{ category: 'fact'|'metric'|'inference'|'suggestion'|'creative',
        text, evidence: { metric?, value?, sourceIds: string[] }, confidence }] */

  model_used  text,
  created_at  timestamptz not null default now()
);
create index if not exists design_insights_space_created_idx
  on design_insights (space_id, created_at desc);
create index if not exists design_insights_snapshot_idx on design_insights (snapshot_id);

-- Provider webhook 去重（v1.0 §17.5）。無 space_id、僅 service role。
create table if not exists provider_webhooks (
  id            uuid primary key default gen_random_uuid(),
  provider      text not null,
  external_event_id text not null,
  connection_id uuid references design_connections(id) on delete cascade,
  payload       jsonb not null,
  signature_ok  boolean not null,
  processed_at  timestamptz,
  received_at   timestamptz not null default now(),
  unique (provider, external_event_id)
);

-- ── updated_at 自動維護 ────────────────────────────────
drop trigger if exists projects_touch on projects;
create trigger projects_touch before update on projects
  for each row execute function public.touch_updated_at();

drop trigger if exists design_connections_touch on design_connections;
create trigger design_connections_touch before update on design_connections
  for each row execute function public.touch_updated_at();

drop trigger if exists design_files_touch on design_files;
create trigger design_files_touch before update on design_files
  for each row execute function public.touch_updated_at();

-- ── RLS ────────────────────────────────────────────────
alter table projects           enable row level security;
alter table design_connections enable row level security;
alter table design_files       enable row level security;
alter table design_snapshots   enable row level security;
alter table design_insights    enable row level security;
alter table provider_webhooks  enable row level security;   -- 無 policy = 僅 service role

drop policy if exists "member manages projects" on projects;
create policy "member manages projects" on projects
  for all using (is_space_member(space_id)) with check (is_space_member(space_id));

-- 連線含 token，僅 owner 可見（02-domain-model.md §6.3）
drop policy if exists "owner reads connections" on design_connections;
create policy "owner reads connections" on design_connections
  for select using (is_space_owner(space_id));
drop policy if exists "owner manages connections" on design_connections;
create policy "owner manages connections" on design_connections
  for all using (is_space_owner(space_id)) with check (is_space_owner(space_id));

drop policy if exists "member manages design files" on design_files;
create policy "member manages design files" on design_files
  for all using (is_space_member(space_id)) with check (is_space_member(space_id));

-- snapshot 代表版本，不該被使用者偽造 —— 只開 SELECT，建立走 service role。
drop policy if exists "member reads snapshots" on design_snapshots;
create policy "member reads snapshots" on design_snapshots
  for select using (is_space_member(space_id));

drop policy if exists "member reads design insights" on design_insights;
create policy "member reads design insights" on design_insights
  for select using (is_space_member(space_id));

-- ── GRANT（最小權限；0007 的 default privileges 給的是 all，這裡收緊）──
grant select, insert, update, delete on projects     to authenticated;
grant all    on projects     to service_role;
grant select, insert, update, delete on design_files to authenticated;
grant all    on design_files to service_role;
grant select on design_connections to authenticated; -- token 欄位由 API 層排除
grant all    on design_connections to service_role;
grant select on design_snapshots to authenticated;
grant all    on design_snapshots to service_role;
grant select on design_insights  to authenticated;
grant all    on design_insights  to service_role;
grant all    on provider_webhooks to service_role;
