-- 0048_design_file_visibility.sql
-- 每個作品（design_file）自己的可見性：private（只有成員）/ unlisted（有連結才看）/ public（列在公開作品集）。
-- 預設 private —— 對外曝光一律 opt-in，使用者主動改才會公開。
--
-- 這裡只加欄位 + 索引；anon 讀取的 RLS policy 與公開路由在下一個 migration/commit 才開，
-- 讓「加欄位」與「真正對外曝光」兩件事分開、可分別審。

alter table design_files
  add column if not exists visibility text not null default 'private'
    check (visibility in ('private','unlisted','public'));

-- 公開作品集列表查詢用（只列 public、未刪除）
create index if not exists design_files_public_idx
  on design_files (space_id, updated_at desc)
  where visibility = 'public' and deleted_at is null;
