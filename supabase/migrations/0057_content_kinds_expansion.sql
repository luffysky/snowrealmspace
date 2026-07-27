-- 0057_content_kinds_expansion.sql
-- 內容池新增類型：每日一問(question)、微行動(micro_action)、季節·節氣(seasonal)、
-- 里程碑回顧(milestone)。見 09-content-pool.md。
--
-- 只放寬 CHECK 約束（相容、冪等）。約束是匿名建立的，Postgres 預設命名為
-- <table>_<column>_check —— drop if exists 後重建。

alter table content_items drop constraint if exists content_items_kind_check;
alter table content_items add constraint content_items_kind_check
  check (kind in (
    'quote', 'prompt', 'greeting', 'surprise', 'chain',
    'question', 'micro_action', 'seasonal', 'milestone'
  ));

-- daily_items：新增每日一問 / 微行動 / 季節的「已生成」記錄類型
-- （milestone 早已存在）。
alter table daily_items drop constraint if exists daily_items_kind_check;
alter table daily_items add constraint daily_items_kind_check
  check (kind in (
    'daily_card', 'agent_note', 'creative_prompt', 'background_event',
    'theme_suggestion', 'unfinished_nudge', 'memory_callback', 'milestone',
    'daily_question', 'micro_action', 'seasonal'
  ));
