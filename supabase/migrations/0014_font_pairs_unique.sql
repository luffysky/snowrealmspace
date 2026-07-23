-- font_pairs 需要唯一鍵才能 upsert。
--
-- 0009 建表時沒加，因為當時還沒有寫入路徑。
-- scripts/upload-fonts.ts 是冪等的（可重複執行），
-- 沒有這條約束的話重跑會插入重複的配對而不是更新。
create unique index if not exists font_pairs_name_key on font_pairs (name);

grant select on fonts       to authenticated, anon;
grant select on font_pairs  to authenticated, anon;
grant all    on fonts       to service_role;
grant all    on font_pairs  to service_role;
