-- 0047_weekly_recap_email.sql
-- 週報 email 寄送的 opt-in 開關（預設關；使用者到設定頁自己開）。
-- in-app 週報通知一直都有；這個只控制「要不要順便寄一封 email」。
alter table space_settings
  add column if not exists weekly_recap_email boolean not null default false;
