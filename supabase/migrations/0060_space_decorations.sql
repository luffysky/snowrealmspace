-- 0060_space_decorations.sql
-- 裝飾品 widget：使用者在空間頁面上自由擺放的可愛小圖（Fluent Emoji）。
-- 每個 space 一組，overlay 浮在所有頁面之上；位置以「視窗比例 0..1」存，
-- 換裝置/尺寸都能等比還原。位元組不入此表：圖來自內建 /decorations/*.svg（ADR-005）。
--
-- 授權一律用 space_id（ADR-006），RLS 用 is_space_member；policy 樣式抄自
-- 0010_backgrounds.sql 的 background_items。grant 靠 0007 的 default privileges
-- 自動涵蓋（background_items 也沒有各自的 grant，這裡一致）。
-- 冪等：create ... if not exists / drop policy|trigger if exists（migrate 會重跑）。

create table if not exists space_decorations (
  id            uuid primary key default gen_random_uuid(),
  space_id      uuid not null references spaces(id) on delete cascade,

  decoration_id text not null,                 -- 對映 /decorations/<id>.svg，由 app 端名單校驗

  -- 位置：視窗比例（0=左/上，1=右/下）。與尺寸解耦，換螢幕也擺得對。
  x real not null,
  y real not null,

  scale    real not null default 1,            -- 相對基準大小（app 端夾在 0.3..3）
  rotation real not null default 0,            -- 度
  opacity  real not null default 1,            -- 0.1..1

  -- 漸層染色（把 emoji 當剪影填漸層）；null = 保留原始配色。
  -- 形狀 {from,to,angle}，由 app 端 zod 校驗，DB 只當不透明 blob 存。
  tint jsonb,

  z_index int not null default 0,              -- 疊放順序

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists space_decorations_space_idx
  on space_decorations (space_id);

alter table space_decorations enable row level security;

-- 成員即可增刪改查自己 space 的裝飾（與 background_items 完全同一套授權）。
drop policy if exists "member manages decorations" on space_decorations;
create policy "member manages decorations" on space_decorations
  for all using (is_space_member(space_id)) with check (is_space_member(space_id));

-- Postgres 沒有 create trigger if not exists，先 drop 才能重跑（見 0010 的說明）。
drop trigger if exists space_decorations_touch on space_decorations;
create trigger space_decorations_touch before update on space_decorations
  for each row execute function public.touch_updated_at();
