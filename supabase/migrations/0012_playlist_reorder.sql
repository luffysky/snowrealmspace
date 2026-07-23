-- 0012_playlist_reorder.sql
--
-- 拖曳重排必須在單一 transaction 內完成：
-- 中間狀態必然出現重複 position，靠 deferrable unique constraint
-- 延到 commit 才檢查（0010_backgrounds.sql）。
--
-- supabase-js 沒有 transaction API，所以包成 RPC。
-- 分多次 UPDATE 會讓約束在每次語句後就檢查，直接違反。

create or replace function public.reorder_playlist_items(
  target_playlist_id uuid,
  ordered_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item_id uuid;
  idx integer := 0;
begin
  -- 只處理真的屬於這個清單的項目。傳入不屬於它的 id 會被忽略，
  -- 而不是靜默寫到別人的清單去。
  foreach item_id in array ordered_ids loop
    update background_playlist_items
       set position = idx
     where id = item_id
       and playlist_id = target_playlist_id;
    idx := idx + 1;
  end loop;
end $$;

revoke all on function public.reorder_playlist_items(uuid, uuid[]) from public;
grant execute on function public.reorder_playlist_items(uuid, uuid[]) to service_role;
