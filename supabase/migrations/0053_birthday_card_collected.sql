-- 0053_birthday_card_collected.sql
-- 生日信封卡「收藏」狀態：壽星在 Home 親手打開信封並收進收藏後，時間戳記在這。
-- null = 還沒收藏（信封留在 Home 等她打開）；有值 = 已收藏（改於驚喜收藏頁常駐）。
-- 冪等：add column if not exists。
alter table space_settings
  add column if not exists birthday_card_collected_at timestamptz;
