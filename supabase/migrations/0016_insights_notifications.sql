-- Milestone E：Insight Engine 與 in-app 通知。
-- agent_messages / threads 屬 Milestone D，這裡不建。
-- 主動訊息（E）走 notifications（category='agent'）與內容池，不需要 D 的 agent 基礎設施。

-- ── Insights（03-database.md）──────────────────────────────
-- 本階段只產 fact / metric（本地演算法，confidence=1.0，evidence.sourceIds 必填）。
-- inference / suggestion / creative 需 LLM，留待 Milestone D。
create table if not exists insights (
  id       uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,

  type      text not null,
  title     text not null,
  statement text not null,
  evidence  jsonb not null default '{}',
  confidence numeric not null check (confidence between 0 and 1),
  visibility text not null default 'private' check (visibility in ('private','shareable')),

  period_start date,
  period_end   date,

  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- 同一週期同類型只產一次（冪等）
  unique (space_id, type, period_start, period_end)
);
create index if not exists insights_space_created_idx
  on insights (space_id, created_at desc) where deleted_at is null;

-- ── Notifications（0012_notifications.sql）────────────────
create table if not exists notifications (
  id       uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,

  category text not null check (category in
    ('sync_success','sync_failed','daily','agent','weekly_recap',
     'milestone','oauth_expired','processing_done','quota')),
  title text not null,
  body  text,
  link  text,
  payload jsonb not null default '{}',

  channel text not null default 'in_app'
            check (channel in ('in_app','email','web_push','mobile_push')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_unread_idx
  on notifications (user_id, created_at desc) where read_at is null;
create index if not exists notifications_space_created_idx
  on notifications (space_id, created_at desc);

-- 主動訊息的頻率上限（3/日）查詢：某 space 某天的 agent 通知數
create index if not exists notifications_space_agent_idx
  on notifications (space_id, created_at) where category = 'agent';

-- ── RLS ────────────────────────────────────────────────
alter table insights      enable row level security;
alter table notifications enable row level security;

drop policy if exists "member reads insights" on insights;
create policy "member reads insights" on insights
  for select using (is_space_member(space_id) and deleted_at is null);

-- 產生/刪除走 service role（cron 或使用者觸發後由伺服器代寫）。
-- 使用者刪 insight 的動作經由 API（service role）處理，不直接開 delete 給成員。

drop policy if exists "own notifications" on notifications;
create policy "own notifications" on notifications
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── GRANT（0007 的 default privileges 只涵蓋當時的表）──────
grant select on insights to authenticated;
grant all    on insights to service_role;
grant select, update on notifications to authenticated; -- update：標記已讀
grant all    on notifications to service_role;
