-- 0035 生日鏈只給「生日主角」（Nami），其餘使用者看到歡迎信
--
-- 每個 space_settings 一個旗標；預設 false（新使用者是一般歡迎）。
-- 幫 Nami 開啟：scripts/set-birthday-recipient.ts，或後台/DB 手動設 true。

alter table space_settings
  add column if not exists is_birthday_recipient boolean not null default false;
