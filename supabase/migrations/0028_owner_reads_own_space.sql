-- 0028 讓 owner 讀得到自己「軟刪除待清除」的 space
--
-- 背景：刪除 space 是「軟刪除 + 7 天寬限 + 清除」（10-acceptance.md）。
-- 但既有的 "member reads space" policy 要求 deleted_at is null，
-- 一旦軟刪除，owner 就再也讀不到 → 沒有辦法做「還原」介面。
--
-- 這條 policy 讓 owner 永遠讀得到自己的 space（含已軟刪除的），
-- 才能在寬限期內顯示「還原」。不影響跨 space 隔離：仍以 is_space_owner 閘門，
-- 別人讀不到；活躍 space 解析另外明確排除 deleted_at（session.ts），
-- 所以軟刪除的 space 不會被當成可進入的空間。

drop policy if exists "owner reads own space" on spaces;
create policy "owner reads own space" on spaces
  for select using (is_space_owner(id));
