-- 0003_rls_helpers.sql
-- Helper 函式 + 啟用 RLS + policy。見 docs/spec/03-database.md §1、§2
--
-- security definer 是必要的：space_members 自身也有 RLS，
-- 若函式以呼叫者權限執行會產生無限遞迴。
-- set search_path 是 security definer 函式的必要防護，不可省略。

create or replace function public.is_space_member(target_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from space_members
    where space_id = target_space_id
      and user_id  = auth.uid()
  );
$$;

create or replace function public.is_space_owner(target_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from space_members
    where space_id = target_space_id
      and user_id  = auth.uid()
      and role     = 'owner'
  );
$$;

revoke all on function public.is_space_member(uuid) from public;
revoke all on function public.is_space_owner(uuid)  from public;
grant execute on function public.is_space_member(uuid) to authenticated;
grant execute on function public.is_space_owner(uuid)  to authenticated;

-- ── 啟用 RLS ────────────────────────────────────────────────
alter table profiles       enable row level security;
alter table spaces         enable row level security;
alter table space_members  enable row level security;
alter table space_invites  enable row level security;
alter table space_settings enable row level security;
alter table agent_profiles enable row level security;

-- ── Policy ─────────────────────────────────────────────────
drop policy if exists "own profile" on profiles;
create policy "own profile" on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "member reads space" on spaces;
create policy "member reads space" on spaces
  for select using (is_space_member(id) and deleted_at is null);

drop policy if exists "owner writes space" on spaces;
create policy "owner writes space" on spaces
  for update using (is_space_owner(id)) with check (is_space_owner(id));

drop policy if exists "owner deletes space" on spaces;
create policy "owner deletes space" on spaces
  for delete using (is_space_owner(id));
-- spaces 的 INSERT 只走 service role（經由邀請流程），不開放 authenticated

drop policy if exists "member reads members" on space_members;
create policy "member reads members" on space_members
  for select using (is_space_member(space_id));

drop policy if exists "owner manages members" on space_members;
create policy "owner manages members" on space_members
  for all using (is_space_owner(space_id)) with check (is_space_owner(space_id));

-- space_invites 的 token_hash 不該被任何 client 讀到；
-- 驗證一律走 service role 端點。這裡只給 owner 看自己 space 的邀請狀態。
drop policy if exists "owner reads invites" on space_invites;
create policy "owner reads invites" on space_invites
  for select using (space_id is not null and is_space_owner(space_id));

drop policy if exists "member reads settings" on space_settings;
create policy "member reads settings" on space_settings
  for select using (is_space_member(space_id));

drop policy if exists "owner writes settings" on space_settings;
create policy "owner writes settings" on space_settings
  for all using (is_space_owner(space_id)) with check (is_space_owner(space_id));

drop policy if exists "member reads agent profile" on agent_profiles;
create policy "member reads agent profile" on agent_profiles
  for select using (is_space_member(space_id));

drop policy if exists "owner writes agent profile" on agent_profiles;
create policy "owner writes agent profile" on agent_profiles
  for all using (is_space_owner(space_id)) with check (is_space_owner(space_id));
