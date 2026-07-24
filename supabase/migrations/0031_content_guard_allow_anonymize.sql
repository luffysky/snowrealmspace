-- 0031 content_guard 放行「actor_id → NULL」的匿名化（供刪除帳號用）
--
-- 潛在 bug（todo_list_0724 記錄）：
--   activity_events.actor_id → auth.users 是 ON DELETE SET NULL。
--   刪除帳號時，FK 會把該使用者留下的事件 actor_id 設成 NULL（匿名化）。
--   但 content_guard 這個 BEFORE UPDATE trigger 硬性把 actor_id pin 回 old，
--   於是 SET NULL 被還原 → FK 判定失敗 → 有活動紀錄的使用者刪不掉。
--
-- 修法：只在「改成別的使用者」時 pin 回 old（防竄改歸屬）；
--   「改成 NULL」放行（這正是刪除帳號的合法匿名化，不是竄改）。
--   其餘內容欄位維持不可竄改。

create or replace function public.activity_events_content_guard()
returns trigger language plpgsql as $$
begin
  new.space_id   := old.space_id;
  -- actor_id 允許被設為 NULL（帳號刪除的匿名化）；但不准改成另一個使用者
  if new.actor_id is not null then
    new.actor_id := old.actor_id;
  end if;
  new.actor_type := old.actor_type;
  new.event_type := old.event_type;
  new.entity_type := old.entity_type;
  new.entity_id  := old.entity_id;
  new.properties := old.properties;
  new.occurred_at := old.occurred_at;
  -- projected_at 允許變動（投影游標）
  return new;
end $$;
