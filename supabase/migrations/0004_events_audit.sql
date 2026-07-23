-- 0004_events_audit.sql
-- ADR-013：activity_events 是唯一 append-only 事實來源。
-- timeline_events（投影表）在 Milestone C 才建立。
-- 見 docs/spec/03-database.md §9、§11

create table if not exists activity_events (
  id           uuid primary key default gen_random_uuid(),
  space_id     uuid not null references spaces(id) on delete cascade,
  actor_id     uuid references auth.users(id) on delete set null,
  actor_type   text not null default 'user' check (actor_type in ('user','agent','system')),

  event_type   text not null,
  entity_type  text,
  entity_id    uuid,
  properties   jsonb not null default '{}',

  occurred_at  timestamptz not null default now(),
  projected_at timestamptz   -- null = 尚未投影到 timeline
);

create index if not exists activity_events_space_time_idx
  on activity_events (space_id, occurred_at desc);
create index if not exists activity_events_space_type_idx
  on activity_events (space_id, event_type, occurred_at desc);
create index if not exists activity_events_unprojected_idx
  on activity_events (occurred_at) where projected_at is null;

-- append-only 用 RULE 強制，不靠自律。
-- 注意：CASCADE 刪除不受 RULE 影響，所以 space 刪除仍能清空事件。
drop rule if exists activity_events_no_update on activity_events;
create rule activity_events_no_update as
  on update to activity_events do instead nothing;

drop rule if exists activity_events_no_delete on activity_events;
create rule activity_events_no_delete as
  on delete to activity_events do instead nothing;

create table if not exists audit_logs (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid references spaces(id) on delete cascade,
  actor_id    uuid references auth.users(id) on delete set null,
  actor_type  text not null default 'user' check (actor_type in ('user','agent','system')),

  action      text not null,
  entity_type text,
  entity_id   uuid,
  before      jsonb,
  after       jsonb,

  ip_hash     text,   -- 雜湊，非明文 IP
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists audit_logs_space_time_idx on audit_logs (space_id, created_at desc);
create index if not exists audit_logs_entity_idx     on audit_logs (entity_type, entity_id);

alter table activity_events enable row level security;
alter table audit_logs      enable row level security;

drop policy if exists "member reads activity" on activity_events;
create policy "member reads activity" on activity_events
  for select using (is_space_member(space_id));
-- INSERT 僅 service role

drop policy if exists "owner reads audit" on audit_logs;
create policy "owner reads audit" on audit_logs
  for select using (space_id is not null and is_space_owner(space_id));
