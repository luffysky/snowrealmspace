-- 0029 purge_space()：安全地永久刪除已軟刪除的 space（給 space-purge job 用）
--
-- 為什麼需要這個函式而不是直接 delete：
--   space-purge 用 service role 刪除軟刪除的 space。刪 spaces 會觸發子表的
--   ON DELETE CASCADE，而 CASCADE 的參照完整性檢查在 RLS 下會去查 spaces 這張表；
--   但 spaces 的讀取 policy 要求 deleted_at is null，於是「已軟刪除」的 parent 對
--   RI 檢查不可見，PostgreSQL 直接報 "referential integrity query gave unexpected result"。
--
-- SECURITY DEFINER 讓刪除以函式擁有者（bypass RLS 的 postgres）身分執行，
-- cascade 與 RI 檢查都能正常看到 parent。加 deleted_at is not null 護欄：
-- 這個函式**只**清除已軟刪除的 space，永遠不會誤刪還活著的空間。

create or replace function public.purge_space(target_space_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from spaces where id = target_space_id and deleted_at is not null;
end;
$$;

-- 只有 service role（worker/cron）能呼叫，一般使用者不行
revoke all on function public.purge_space(uuid) from public;
revoke all on function public.purge_space(uuid) from anon;
revoke all on function public.purge_space(uuid) from authenticated;
grant execute on function public.purge_space(uuid) to service_role;
