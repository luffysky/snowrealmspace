-- 0044_notifications_birthday_category.sql
-- 修 bug：daily-cron 送生日祝福時 insert category='birthday'，但 0016 的 CHECK 不含 'birthday'
-- → 生日通知 insert 直接違反約束拋錯，被 try/catch 吞掉，birthday_greeted_year 也沒更新。
-- 結果：生日祝福（旗艦功能）在當天靜默失敗（違反「靜默失敗是 bug」）。
-- 這裡把 'birthday' 補進允許清單。冪等：先 drop 再 add。

alter table notifications drop constraint if exists notifications_category_check;
alter table notifications add constraint notifications_category_check
  check (category in
    ('sync_success','sync_failed','daily','agent','weekly_recap',
     'milestone','oauth_expired','processing_done','quota','birthday'));
