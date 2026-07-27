-- 0058_welcome_kind.sql
-- 歡迎鏈：非生日時，首頁每天一句歡迎（給「回家」的感覺）。
-- 是每日輪替的內容池（不存 daily_items，跟日期決定性掛勾即可），只需擴 content_items.kind。

alter table content_items drop constraint if exists content_items_kind_check;
alter table content_items add constraint content_items_kind_check
  check (kind in (
    'quote', 'prompt', 'greeting', 'surprise', 'chain',
    'question', 'micro_action', 'seasonal', 'milestone', 'welcome'
  ));
