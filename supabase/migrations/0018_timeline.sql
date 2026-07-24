-- 0018_timeline.sql
-- 實作 ADR-013：activity_events（0004 已建）是唯一 append-only 事實來源，
-- timeline_events 是它的投影表 —— 由 event.project job 從 activity_events 投影而來。
-- 見 docs/spec/03-database.md §9、08-jobs-events.md。
--
-- 為什麼要投影表而非直接查 activity_events：
--   1. timeline 的 title/body/visibility 使用者可編輯，activity_events 不可變。
--   2. 一筆活動可能被節流／合併成一則 timeline（投影規則），非 1:1。

create table if not exists timeline_events (
  id       uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  source_event_id uuid references activity_events(id) on delete set null,

  event_type text not null,
  title      text not null,          -- 使用者可編輯
  body       text,
  entity_type text,
  entity_id   uuid,
  cover_asset_id uuid references assets(id) on delete set null,
  project_id  uuid references projects(id) on delete set null,

  visibility text not null default 'private'
               check (visibility in ('private','shareable','hidden')),
  occurred_at timestamptz not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists timeline_events_space_time_idx
  on timeline_events (space_id, occurred_at desc) where deleted_at is null;
create index if not exists timeline_events_project_idx
  on timeline_events (project_id) where deleted_at is null;
create index if not exists timeline_events_space_type_idx
  on timeline_events (space_id, event_type);

-- 投影去重：同一 activity_event 只投影一次（job 冪等的 DB 保證）。
create unique index if not exists timeline_events_source_uq
  on timeline_events (source_event_id) where source_event_id is not null;

drop trigger if exists timeline_events_touch on timeline_events;
create trigger timeline_events_touch before update on timeline_events
  for each row execute function public.touch_updated_at();

-- ── RLS ────────────────────────────────────────────────
alter table timeline_events enable row level security;

-- 成員只讀「未刪除且非 hidden」的投影 —— visibility='hidden' 是使用者主動隱藏。
drop policy if exists "member reads timeline" on timeline_events;
create policy "member reads timeline" on timeline_events
  for select using (
    is_space_member(space_id) and deleted_at is null and visibility <> 'hidden'
  );
-- 編輯標題／可見性／刪除（軟刪）由 owner 進行；投影寫入走 service role（job）。
drop policy if exists "owner manages timeline" on timeline_events;
create policy "owner manages timeline" on timeline_events
  for all using (is_space_owner(space_id)) with check (is_space_owner(space_id));

-- ── GRANT ──────────────────────────────────────────────
grant select, update on timeline_events to authenticated; -- update：改標題/可見性/軟刪
grant all    on timeline_events to service_role;
