-- 0039_ai_quota_config.sql
-- AI 每日額度上限改為後台可設定（原本寫死在 apps/web/lib/ai/deps.ts 的 300 / 20）。
-- 全域單列設定；RLS 開、零 policy = 只有 service role 能碰（同 ai_usage_models 慣例）。

create table if not exists ai_quota_config (
  id             text primary key default 'global' check (id = 'global'),
  free_daily_cap integer not null default 300 check (free_daily_cap >= 0),
  paid_daily_cap integer not null default 20  check (paid_daily_cap >= 0),
  updated_at     timestamptz not null default now(),
  updated_by     uuid references auth.users(id)
);

-- 種一列全域預設（沿用原本寫死的值）
insert into ai_quota_config (id) values ('global') on conflict (id) do nothing;

alter table ai_quota_config enable row level security;
revoke all on ai_quota_config from anon, authenticated;
grant all on ai_quota_config to service_role;

drop trigger if exists ai_quota_config_touch on ai_quota_config;
create trigger ai_quota_config_touch before update on ai_quota_config
  for each row execute function public.touch_updated_at();
