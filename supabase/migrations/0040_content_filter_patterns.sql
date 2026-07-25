-- 0040_content_filter_patterns.sql
-- 後台可新增的內容安全字樣（正則）。
--
-- 重要：這是**附加層**，不是取代。程式碼裡的 FORBIDDEN_PATTERNS 仍是不可停用的安全底線
-- （build-time check:content 與 runtime 都會套）。這張表只能「多加」規則，無法關掉底線。
-- RLS 開、零 policy = 只有 service role 能碰（同 ai_usage_models／ai_quota_config 慣例）。

create table if not exists content_filter_patterns (
  id          uuid primary key default gen_random_uuid(),
  pattern     text not null check (char_length(pattern) between 1 and 200),
  description text,
  enabled     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id)
);
create index if not exists content_filter_patterns_enabled_idx
  on content_filter_patterns (enabled) where enabled = true;

alter table content_filter_patterns enable row level security;
revoke all on content_filter_patterns from anon, authenticated;
grant all on content_filter_patterns to service_role;

drop trigger if exists content_filter_patterns_touch on content_filter_patterns;
create trigger content_filter_patterns_touch before update on content_filter_patterns
  for each row execute function public.touch_updated_at();
