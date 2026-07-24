-- 0020_activity_events_projection.sql
-- Milestone C5：Timeline 投影需要把已投影的 activity_event 標記 projected_at。
--
-- 但 0004 用 `on update do instead nothing` 的 RULE 擋掉了所有 update，
-- 連 projected_at 都寫不進去 —— 投影 job 的游標就失效了（每輪都重掃全部）。
--
-- 解法：把 blanket update rule 換成 BEFORE UPDATE trigger，
-- 只 pin 住「內容欄位」（append-only 的本意是內容不可竄改），
-- 放行 projected_at。delete 仍以 RULE 全擋（append-only 不可刪，除了 CASCADE）。
--
-- 這保住了 ADR-013 的「事件流不可能被竄改」，同時讓投影游標能運作。

-- 內容欄位守門：任何對內容的修改都被還原成原值，只有 projected_at 可變。
create or replace function public.activity_events_content_guard()
returns trigger language plpgsql as $$
begin
  new.space_id   := old.space_id;
  new.actor_id   := old.actor_id;
  new.actor_type := old.actor_type;
  new.event_type := old.event_type;
  new.entity_type := old.entity_type;
  new.entity_id  := old.entity_id;
  new.properties := old.properties;
  new.occurred_at := old.occurred_at;
  -- projected_at 允許變動（投影游標）
  return new;
end $$;

-- 移除「擋所有 update」的 rule（trigger 取代它，且更精準）
drop rule if exists activity_events_no_update on activity_events;

drop trigger if exists activity_events_content_guard on activity_events;
create trigger activity_events_content_guard
  before update on activity_events
  for each row execute function public.activity_events_content_guard();

-- delete 仍全擋（CASCADE 不受 rule 影響，帳號/ space 刪除照常）
-- activity_events_no_delete 由 0004 建立，這裡不動。
