-- 0023_ai_core.sql
-- Milestone D 的資料層。見 docs/spec/12-ai-model-routing.md §6。
--
-- 金鑰表、模型清單、候選鏈：僅 service role（RLS 開、零 policy = 全拒絕）。
-- 用量與額度：space member 可讀自己 space 的（看得到自己用量），僅 service role 可寫。
-- 快取：僅 service role（跨 space 快取隔離是隱私要求，§5.3）。

-- 可用模型清單（後台維護）
create table if not exists ai_models (
  id                  uuid primary key default gen_random_uuid(),
  provider            text not null,
  model_name          text not null,
  display_name        text not null,
  description         text,
  context_window      integer,
  cost_input_per_1m   numeric(10,4) not null default 0,
  cost_output_per_1m  numeric(10,4) not null default 0,
  is_free             boolean not null default false,
  supports_vision     boolean not null default false,
  supports_tools      boolean not null default false,
  supports_streaming  boolean not null default true,
  is_active           boolean not null default true,
  sort_order          integer not null default 0,
  notes               text,
  metadata            jsonb not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (provider, model_name)
);

-- Provider 金鑰（AES-256-GCM 加密，主金鑰在 AI_KEY_ENCRYPTION_SECRET）
create table if not exists ai_provider_keys (
  id                    uuid primary key default gen_random_uuid(),
  provider              text not null unique,
  api_key_encrypted     text not null,
  monthly_budget_usd    numeric(10,2),
  used_this_month_usd   numeric(10,4) not null default 0,
  budget_reset_at       date not null,
  enabled               boolean not null default true,
  last_ok_at            timestamptz,
  last_error            text,
  updated_at            timestamptz not null default now()
);

-- 用途 → 候選鏈
create table if not exists ai_usage_models (
  usage_key    text primary key,
  model_name   text not null,
  candidates   jsonb not null default '[]',
  enabled      boolean not null default true,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users(id)
);

-- 每次呼叫的用量（成本歸因的唯一真相）
create table if not exists ai_usage_log (
  id                 uuid primary key default gen_random_uuid(),
  space_id           uuid references spaces(id) on delete cascade,
  usage_key          text not null,
  provider           text not null,
  model              text not null,
  is_free            boolean not null,
  fell_back          boolean not null default false,
  escalated          boolean not null default false,
  degraded           boolean not null default false,
  cache_hit          text,
  attempts           integer not null default 1,
  tokens_input       integer not null default 0,
  tokens_output      integer not null default 0,
  cache_write_tokens integer not null default 0,
  cache_read_tokens  integer not null default 0,
  cost_usd           numeric(12,8) not null default 0,
  latency_ms         integer,
  error              text,
  created_at         timestamptz not null default now()
);
create index if not exists ai_usage_log_space_idx on ai_usage_log (space_id, created_at desc);
create index if not exists ai_usage_log_usage_idx on ai_usage_log (usage_key, created_at desc);
create index if not exists ai_usage_log_paid_idx on ai_usage_log (created_at desc) where is_free = false;

-- 每日額度（免費/付費分開）
create table if not exists ai_daily_quota (
  space_id     uuid not null references spaces(id) on delete cascade,
  local_date   date not null,
  free_calls   integer not null default 0,
  paid_calls   integer not null default 0,
  vision_calls integer not null default 0,
  primary key (space_id, local_date)
);

-- 回應快取
create table if not exists ai_response_cache (
  id            uuid primary key default gen_random_uuid(),
  usage_key     text not null,
  scope         text not null default 'space',
  space_id      uuid references spaces(id) on delete cascade,
  prompt_hash   text not null,
  context_hash  text not null,
  embedding     vector(768),
  response_text text not null,
  hit_count     integer not null default 0,
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now(),
  constraint cache_scope_check check (
    (scope = 'space'  and space_id is not null) or
    (scope = 'global' and space_id is null)
  )
);
create unique index if not exists ai_response_cache_uq on ai_response_cache
  (usage_key, scope, coalesce(space_id, '00000000-0000-0000-0000-000000000000'::uuid), prompt_hash, context_hash);
create index if not exists ai_response_cache_embedding_idx on ai_response_cache
  using ivfflat (embedding vector_cosine_ops);

-- touch triggers
drop trigger if exists ai_models_touch on ai_models;
create trigger ai_models_touch before update on ai_models
  for each row execute function public.touch_updated_at();

-- ── RLS ────────────────────────────────────────────────
-- 系統設定與金鑰：RLS 開、零 policy = 只有 service role（繞過 RLS）能碰。
alter table ai_models         enable row level security;
alter table ai_provider_keys  enable row level security;
alter table ai_usage_models   enable row level security;
alter table ai_response_cache enable row level security;

-- 用量與額度：成員可讀自己 space 的，寫入僅 service role。
alter table ai_usage_log   enable row level security;
alter table ai_daily_quota enable row level security;

drop policy if exists "member reads own usage" on ai_usage_log;
create policy "member reads own usage" on ai_usage_log
  for select using (space_id is not null and is_space_member(space_id));

drop policy if exists "member reads own quota" on ai_daily_quota;
create policy "member reads own quota" on ai_daily_quota
  for select using (is_space_member(space_id));

-- ── GRANT（金鑰表尤其：撤銷一般角色，只留 service role）──
revoke all on ai_provider_keys from anon, authenticated;
revoke all on ai_models        from anon, authenticated;
revoke all on ai_usage_models  from anon, authenticated;
revoke all on ai_response_cache from anon, authenticated;
grant all on ai_provider_keys  to service_role;
grant all on ai_models         to service_role;
grant all on ai_usage_models   to service_role;
grant all on ai_response_cache to service_role;

grant select on ai_usage_log   to authenticated;
grant all    on ai_usage_log   to service_role;
grant select on ai_daily_quota to authenticated;
grant all    on ai_daily_quota to service_role;
