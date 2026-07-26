-- 0054_admin_secret_notes.sql
-- 站台管理員的 secret 紀錄本。
--
-- 值一律以 AES-256-GCM 加密後才存（主金鑰在 env，不在 DB）—— DB 外洩也拿不到明文。
-- 這是全域資源（非某個 space），所以 RLS 開啟但**不建任何 policy**：
-- 只有 service role（繞過 RLS）能存取，路由層先過 checkSiteAdmin 才動用 service role。
-- 一般使用者一律被 RLS 拒絕。

create table if not exists admin_secret_notes (
  id              uuid primary key default gen_random_uuid(),
  label           text not null,
  purpose         text,
  length_bytes    integer,
  encoding        text,
  value_encrypted text not null,   -- iv:tag:ciphertext（皆 base64）
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  constraint admin_secret_label_len check (char_length(label) between 1 and 120)
);
create index if not exists admin_secret_notes_created_idx
  on admin_secret_notes (created_at desc);

alter table admin_secret_notes enable row level security;
-- 刻意不建任何 policy：只有 service role 能讀寫。grants 由 0007 的 default privileges 涵蓋。
