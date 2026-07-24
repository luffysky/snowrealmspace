-- 0036 個人生日（選填）：有填就在生日當天寄祝福 + 驚喜，沒填就不做。
--
-- 只存月/日、不存年（隱私——祝生日快樂不需要知道年齡）。皆可為 null（沒填）。

alter table space_settings
  add column if not exists birthday_month smallint check (birthday_month between 1 and 12),
  add column if not exists birthday_day smallint check (birthday_day between 1 and 31),
  -- 記錄上次寄生日祝福的年份，避免同一天重複寄（cron 每小時掃）
  add column if not exists birthday_greeted_year smallint;
