-- 0024_ai_quota_fn.sql
-- 原子累計每日 AI 額度。見 docs/spec/12-ai-model-routing.md §4.5。
-- 讀-改-寫會 race，交給 DB 的 upsert + 條件累加保證原子性。

create or replace function public.increment_ai_quota(
  p_space_id  uuid,
  p_local_date date,
  p_is_free   boolean
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into ai_daily_quota (space_id, local_date, free_calls, paid_calls)
  values (
    p_space_id,
    p_local_date,
    case when p_is_free then 1 else 0 end,
    case when p_is_free then 0 else 1 end
  )
  on conflict (space_id, local_date) do update set
    free_calls = ai_daily_quota.free_calls + case when p_is_free then 1 else 0 end,
    paid_calls = ai_daily_quota.paid_calls + case when p_is_free then 0 else 1 end;
$$;

revoke all on function public.increment_ai_quota(uuid, date, boolean) from public;
grant execute on function public.increment_ai_quota(uuid, date, boolean) to service_role;
