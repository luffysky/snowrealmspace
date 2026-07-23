-- 0005_flags_jobs.sql
-- ADR-018（feature flag）+ ADR-007（job 追蹤）
-- 見 docs/spec/03-database.md §11

create table if not exists feature_flags (
  key         text primary key,
  description text,
  enabled     boolean not null default false,
  updated_at  timestamptz not null default now()
);

create table if not exists space_feature_overrides (
  space_id uuid not null references spaces(id) on delete cascade,
  key      text not null references feature_flags(key) on delete cascade,
  enabled  boolean not null,
  primary key (space_id, key)
);

-- pg-boss 自建 pgboss schema；這張表是給 UI 顯示進度用的自有追蹤
create table if not exists job_records (
  id       uuid primary key default gen_random_uuid(),
  space_id uuid references spaces(id) on delete cascade,

  type    text not null,
  status  text not null default 'queued'
            check (status in ('queued','running','completed','failed','cancelled')),
  payload jsonb not null default '{}',
  result  jsonb,

  idempotency_key text unique,
  retry_count integer not null default 0,
  last_error  text,

  created_at   timestamptz not null default now(),
  started_at   timestamptz,
  completed_at timestamptz
);

create index if not exists job_records_space_idx on job_records (space_id, created_at desc);
create index if not exists job_records_active_idx
  on job_records (status, created_at) where status in ('queued','running');

alter table feature_flags           enable row level security;
alter table space_feature_overrides enable row level security;
alter table job_records             enable row level security;

drop policy if exists "anyone reads flags" on feature_flags;
create policy "anyone reads flags" on feature_flags for select using (true);

drop policy if exists "member reads overrides" on space_feature_overrides;
create policy "member reads overrides" on space_feature_overrides
  for select using (is_space_member(space_id));

drop policy if exists "member reads jobs" on job_records;
create policy "member reads jobs" on job_records
  for select using (space_id is not null and is_space_member(space_id));
