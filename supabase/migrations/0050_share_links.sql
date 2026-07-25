-- 0050_share_links.sql
-- 唯讀分享連結：可設到期、可撤銷。與 visibility 不同——分享連結對「私人作品」也有效
-- （這正是它的用途：臨時把一件私人作品分享給沒有帳號的人，token 就是授權）。
--
-- 安全：/s/<token> 是 anon 入口，但 anon 對這張表**沒有** policy；token 查詢一律走 service role
-- （token 本身即授權，等同邀請驗證——rule #10 允許的 service-role 用途）。

create table if not exists share_links (
  id             uuid primary key default gen_random_uuid(),
  token          text not null unique,
  space_id       uuid not null references spaces(id) on delete cascade,
  design_file_id uuid not null references design_files(id) on delete cascade,
  expires_at     timestamptz,   -- null = 永久有效
  revoked_at     timestamptz,   -- 非 null = 已撤銷
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists share_links_file_idx
  on share_links (design_file_id, created_at desc) where revoked_at is null;
create index if not exists share_links_token_idx on share_links (token);

alter table share_links enable row level security;
-- 成員可管理自己 space 的分享連結；anon 無 policy（走 service role 查 token）。
drop policy if exists "member manages share links" on share_links;
create policy "member manages share links" on share_links
  for all using (is_space_member(space_id)) with check (is_space_member(space_id));
