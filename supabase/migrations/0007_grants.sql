-- 0007_grants.sql
--
-- Supabase 的安全模型是「GRANT 放寬、RLS 收緊」：
-- 角色對表有 DML 權限，實際能看到哪些列由 RLS policy 決定。
--
-- 這支 migration 存在的理由：`db:reset` 會 drop public schema，
-- 連帶清掉 Supabase 預設的 grant 與 default privileges。
-- 寫成 migration 讓本機 reset 與全新 hosted 專案走同一條路徑。

grant usage on schema public to postgres, anon, authenticated, service_role;

grant all on all tables    in schema public to postgres, anon, authenticated, service_role;
grant all on all routines  in schema public to postgres, anon, authenticated, service_role;
grant all on all sequences in schema public to postgres, anon, authenticated, service_role;

-- 之後 migration 新增的表自動套用同樣的 grant
alter default privileges for role postgres in schema public
  grant all on tables    to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on routines  to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to postgres, anon, authenticated, service_role;
