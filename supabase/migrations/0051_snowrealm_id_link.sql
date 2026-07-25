-- 0051_snowrealm_id_link.sql
-- ADR-024：預先備好 Space 端的 SnowRealm ID 綁定欄位（發證方 snowrealm-id 尚未建立，先加不啟用）。
--
-- Space 是單一產品，本地只需一對一對應（這個 Space 帳號 ↔ 一個 snowrealm_id）。
-- 全域「一個 snowrealm_id ↔ 多產品帳號」的 identity_links 表屬於 snowrealm-id 專案，不在此。
--
-- link_method 記綁定方式（GPT platform.md 的坑#1：email 不能當唯一依據）：
--   explicit       = 登入產品後主動綁定（最可靠，跨 email 也行）
--   verified_email = 首次 SSO 用「已驗證 email」自動比對（便利路徑，非唯一依據）

alter table profiles add column if not exists snowrealm_id text unique;
alter table profiles add column if not exists snowrealm_linked_at timestamptz;
alter table profiles add column if not exists snowrealm_link_method text
  check (snowrealm_link_method in ('explicit', 'verified_email'));

comment on column profiles.snowrealm_id is 'ADR-024：對應 snowrealm-id 發證方的 sub；null=尚未綁定';
