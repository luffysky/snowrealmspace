-- 0049_public_read_policies.sql
-- 對外曝光的 RLS：只給 anon 角色「唯讀」且只限 public/unlisted 的作品。
--
-- 安全設計：
--  * 這些 policy 只對 anon 角色生效（登入者是 authenticated，走既有成員 policy；service_role 繞過）。
--  * 全站唯一的 anon 進入點是 (public) 路由群 + /api/public/*（middleware 放行、其餘仍在密碼閘門後）。
--  * 只露 design_files / design_snapshots / spaces 三張，且都嚴格綁 visibility；
--    assets 不開 anon policy —— 公開圖片走 /api/public/asset-url，由該路由先驗證作品公開再簽 URL。
--  * private 作品永遠讀不到；unlisted 讀得到但不被列出（要知道 id/連結）。

-- design_files：anon 只看得到 public / unlisted 且未刪除的
drop policy if exists "anon reads shareable files" on design_files;
create policy "anon reads shareable files" on design_files
  for select to anon
  using (visibility in ('public','unlisted') and deleted_at is null);

-- design_snapshots：anon 看得到「parent 作品是 public/unlisted」的快照
drop policy if exists "anon reads shareable snapshots" on design_snapshots;
create policy "anon reads shareable snapshots" on design_snapshots
  for select to anon
  using (
    exists (
      select 1 from design_files df
      where df.id = design_snapshots.design_file_id
        and df.visibility in ('public','unlisted')
        and df.deleted_at is null
    )
  );

-- spaces：anon 只讀得到「有至少一件 public 作品」的空間（用於公開作品集頁的名稱/slug）。
-- 這讓「空間是否有公開頁」完全由 per-work 可見性決定，不需要另一個空間層開關。
drop policy if exists "anon reads spaces with public works" on spaces;
create policy "anon reads spaces with public works" on spaces
  for select to anon
  using (
    deleted_at is null
    and exists (
      select 1 from design_files df
      where df.space_id = spaces.id
        and df.visibility = 'public'
        and df.deleted_at is null
    )
  );
