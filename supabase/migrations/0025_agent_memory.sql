-- 0025_agent_memory.sql
-- Milestone D：Agent 對話與記憶。見 docs/spec/03-database.md §8、07-agent.md §5。
--
-- 對話（agent_threads/messages/actions）：space member 可讀自己 space 的。
-- 記憶（memories）：僅 owner 可讀寫（v1.0 §41.2、02-domain-model.md §6.3 —— memories
-- 永不對非 owner 開放）。ADR-014：Agent 產生的記憶不得直接 approved（DB constraint + API 雙重）。

create table if not exists agent_threads (
  id       uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,

  title      text,
  mode       text not null default 'companion',
  project_id uuid references projects(id) on delete set null,
  summary    text,

  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists agent_threads_space_idx
  on agent_threads (space_id, last_message_at desc) where deleted_at is null;

create table if not exists agent_messages (
  id        uuid primary key default gen_random_uuid(),
  space_id  uuid not null references spaces(id) on delete cascade,
  thread_id uuid not null references agent_threads(id) on delete cascade,

  role      text not null check (role in ('user','assistant','tool')),
  content   text,
  blocks    jsonb not null default '[]',
  context_refs jsonb not null default '{}',

  model_used text,
  provider   text,
  is_free    boolean,
  escalated  boolean not null default false,
  tokens_input  integer,
  tokens_output integer,
  latency_ms integer,
  error      text,

  created_at timestamptz not null default now()
);
create index if not exists agent_messages_thread_idx on agent_messages (thread_id, created_at);
create index if not exists agent_messages_space_idx on agent_messages (space_id, created_at desc);

create table if not exists agent_actions (
  id         uuid primary key default gen_random_uuid(),
  space_id   uuid not null references spaces(id) on delete cascade,
  message_id uuid references agent_messages(id) on delete set null,

  tool_name  text not null,
  input      jsonb not null,
  output     jsonb,

  status     text not null default 'pending_confirmation'
               check (status in ('pending_confirmation','approved','rejected','executed','failed','rolled_back')),
  requires_confirmation boolean not null default true,
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,

  undo_payload jsonb,
  undone_at    timestamptz,

  error      text,
  created_at timestamptz not null default now()
);
create index if not exists agent_actions_space_idx on agent_actions (space_id, created_at desc);
create index if not exists agent_actions_pending_idx on agent_actions (status) where status = 'pending_confirmation';

create table if not exists memories (
  id       uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,

  type    text not null,
  content text not null,

  source_type text not null
                check (source_type in ('user_explicit','agent_summary','activity','integration')),
  source_id   text,
  source_message_id uuid references agent_messages(id) on delete set null,

  confidence  numeric not null default 1 check (confidence between 0 and 1),
  sensitivity text not null default 'normal'
                check (sensitivity in ('normal','private','restricted')),
  approved    boolean not null default false,
  rejected_at timestamptz,

  embedding   vector(768),
  expires_at  timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  -- ADR-014：Agent 產生的記憶不得直接 approved（第一層；API 為第二層）
  constraint memory_approval_check check (
    source_type = 'user_explicit' or approved = false or created_by is not null
  )
);
create index if not exists memories_approved_idx
  on memories (space_id) where approved = true and deleted_at is null;
create index if not exists memories_pending_idx
  on memories (space_id, created_at desc) where approved = false and rejected_at is null;
create index if not exists memories_embedding_idx
  on memories using ivfflat (embedding vector_cosine_ops) where approved = true;

-- touch triggers
drop trigger if exists agent_threads_touch on agent_threads;
drop trigger if exists memories_touch on memories;
create trigger memories_touch before update on memories
  for each row execute function public.touch_updated_at();

-- ── RLS ────────────────────────────────────────────────
alter table agent_threads  enable row level security;
alter table agent_messages enable row level security;
alter table agent_actions  enable row level security;
alter table memories       enable row level security;

-- 對話：成員可讀自己 space；寫入走 service role（Agent 代寫）。
drop policy if exists "member reads threads" on agent_threads;
create policy "member reads threads" on agent_threads
  for select using (is_space_member(space_id) and deleted_at is null);
drop policy if exists "member reads messages" on agent_messages;
create policy "member reads messages" on agent_messages
  for select using (is_space_member(space_id));
drop policy if exists "member reads actions" on agent_actions;
create policy "member reads actions" on agent_actions
  for select using (is_space_member(space_id));

-- 記憶：僅 owner 可讀寫（永不對非 owner 開放）。
drop policy if exists "owner manages memories" on memories;
create policy "owner manages memories" on memories
  for all using (is_space_owner(space_id)) with check (is_space_owner(space_id));

-- ── GRANT ──────────────────────────────────────────────
grant select on agent_threads  to authenticated;
grant all    on agent_threads  to service_role;
grant select on agent_messages to authenticated;
grant all    on agent_messages to service_role;
grant select, update on agent_actions to authenticated; -- update：確認/拒絕
grant all    on agent_actions  to service_role;
grant select, update, delete on memories to authenticated; -- 編輯/刪除/批准（update approved）
grant all    on memories to service_role;
