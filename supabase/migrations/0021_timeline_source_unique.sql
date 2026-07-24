-- 0021_timeline_source_unique.sql
-- 0018 的 source_event_id 唯一索引是「部分索引」（where source_event_id is not null）。
-- Postgres 的 ON CONFLICT 無法對部分索引做欄位推斷，投影 job 的 upsert 因此失敗。
--
-- 改成非部分 unique index：Postgres 預設把多個 NULL 視為相異，
-- 所以手動建立、沒有 source_event_id 的 timeline_events 仍可有多筆（null）。
-- 這樣 ON CONFLICT (source_event_id) 就能用了，投影保持冪等。

drop index if exists timeline_events_source_uq;
create unique index if not exists timeline_events_source_uq
  on timeline_events (source_event_id);
