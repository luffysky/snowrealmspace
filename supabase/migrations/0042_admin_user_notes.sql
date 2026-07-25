-- 0042_admin_user_notes.sql
-- CRM：站台管理員對「某位使用者」留的內部註記（維護/客服/追蹤用）。
-- 只有 service role 能碰（後台 API 以 checkSiteAdmin 把關）；無 space_id，屬全域管理資料。

create table if not exists admin_user_notes (
  id              uuid primary key default gen_random_uuid(),
  subject_user_id uuid not null references auth.users(id) on delete cascade,
  author_id       uuid references auth.users(id) on delete set null,
  body            text not null check (char_length(body) between 1 and 2000),
  created_at      timestamptz not null default now()
);
create index if not exists admin_user_notes_subject_idx
  on admin_user_notes (subject_user_id, created_at desc);

alter table admin_user_notes enable row level security;
revoke all on admin_user_notes from anon, authenticated;
grant all on admin_user_notes to service_role;
