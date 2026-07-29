-- 擴充 widget_definitions.category 允許值。
-- 0011 的 CHECK 只含 daily/creative/agent/project/system/utility；
-- Wave1 新增 personal（紀念日/倒數/每日情話），Wave2 會用到 fun/relax（骰子/幸運籤/呼吸練習）。
-- 不先擴 → sync-widget-defs 的 upsert 會違反 widget_definitions_category_check。
-- 冪等：drop if exists + 重建（比照 0044 對 notifications 的做法）。

alter table widget_definitions drop constraint if exists widget_definitions_category_check;
alter table widget_definitions add constraint widget_definitions_category_check
  check (category in ('daily','creative','agent','project','system','utility','personal','fun','relax'));
