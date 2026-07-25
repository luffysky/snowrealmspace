-- 0041_site_roles.sql
-- 站台級角色與特權（參照 AI 島平台角色）。與「space 內角色」(owner/collaborator/guest) 不同：
-- 這是「整個站台」層級——決定能否進後台、是否享有特權（免費用全站資源）。
--
-- 只加欄位，不在 migration 綁定特定使用者（那些 uuid 只存在 hosted；
-- 在 CI/本地的空 auth.users 上 insert 會 FK 違反）。綁定由 hosted 腳本 / 後台 UI 做。

alter table profiles
  add column if not exists site_role text not null default 'member'
    check (site_role in ('owner', 'admin', 'member')),
  add column if not exists privileged boolean not null default false;

-- 後台需要依角色查人；建個部分索引（只有 owner/admin 少數列）
create index if not exists profiles_site_role_idx on profiles (site_role)
  where site_role <> 'member';
