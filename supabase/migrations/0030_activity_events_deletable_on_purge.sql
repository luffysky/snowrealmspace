-- 0030 讓 activity_events 在「清除 space」時可被 cascade 刪除
--
-- 潛在 bug（0020 的註解假設錯誤）：
--   0004/0020 用 `RULE ... ON DELETE DO INSTEAD NOTHING` 讓 activity_events append-only，
--   註解寫「除了 CASCADE」——但 DO INSTEAD NOTHING 的 rule **連 CASCADE 也一起擋**。
--   結果刪除 space 時，cascade 到 activity_events 被 rule 變成 NOTHING，
--   PostgreSQL 報 "referential integrity query gave unexpected result"，整個清除失敗。
--   （由 scripts/verify-space-purge.ts 抓到。）
--
-- 修法：把 delete rule 換成 BEFORE DELETE trigger。
--   * 一般情況：RETURN NULL —— 靜默略過刪除（保留原本 append-only 的行為）。
--   * 清除 space 時：purge_space() 會設 `snowrealm.purging = on`，trigger 放行（RETURN OLD），
--     cascade 才能真正刪掉這個 space 的事件（資料清除權，10-acceptance.md）。

create or replace function public.activity_events_block_delete()
returns trigger language plpgsql as $$
begin
  -- 只有 space 清除流程（purge_space）會把這個旗標設成 on
  if current_setting('snowrealm.purging', true) = 'on' then
    return old;
  end if;
  -- 一般狀況：append-only，靜默略過（等同原本的 DO INSTEAD NOTHING）
  return null;
end $$;

drop rule if exists activity_events_no_delete on activity_events;

drop trigger if exists activity_events_no_delete on activity_events;
create trigger activity_events_no_delete
  before delete on activity_events
  for each row execute function public.activity_events_block_delete();

-- purge_space 設旗標後再刪，cascade 到 activity_events 才會被放行
create or replace function public.purge_space(target_space_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('snowrealm.purging', 'on', true); -- 只在這個 transaction 內有效
  delete from spaces where id = target_space_id and deleted_at is not null;
end;
$$;

revoke all on function public.purge_space(uuid) from public;
revoke all on function public.purge_space(uuid) from anon;
revoke all on function public.purge_space(uuid) from authenticated;
grant execute on function public.purge_space(uuid) to service_role;
