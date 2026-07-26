-- 0055_profile_avatar_asset.sql
-- 使用者大頭貼。
--
-- 位元組只存在 assets（ADR-005）—— 所以這裡存 asset id，不存 URL。
-- 沿用 agent_profiles.avatar_asset_id 的既有模式。asset 刪除時設為 null（不連帶刪頭貼列）。

alter table profiles
  add column if not exists avatar_asset_id uuid references assets(id) on delete set null;
