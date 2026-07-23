-- 0015_content_and_daily.sql
-- Milestone E：內容池 + 每日內容 + 驚喜。
-- 見 09-content-pool.md 與 03-database.md。

-- ── 內容池（全站公開參考資料，非租戶資料）─────────────────
-- 像 fonts 一樣：所有 space 共用同一份池，YAML 由 seed 灌入。
-- 不含 space_id —— 授權是「所有人可讀啟用中的」，沒有租戶維度。
create table if not exists content_items (
  content_id text primary key,                    -- 例如 q-action-001，與 YAML 的 id 一致
  kind       text not null check (kind in ('quote','prompt','greeting','surprise','chain')),

  text  text not null,
  label text,                                     -- surprise 盒子外觀文字

  tags   text[] not null default '{}',
  weight numeric not null default 1 check (weight > 0),

  -- 各類專屬欄位（用得到才填）
  estimated_minutes    integer,                   -- prompt
  min_days_since_signup integer,
  requires_tag         text,
  cooldown_days        integer,
  greeting_slot        text check (greeting_slot in ('morning','afternoon','evening','night')),
  requires_background_changed boolean not null default false,
  rarity      text check (rarity in ('common','uncommon','rare','special','anniversary')),
  chain_index integer,
  available_from text,                            -- chain 的條件解鎖

  enabled    boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists content_items_kind_idx on content_items (kind) where enabled = true;
create index if not exists content_items_greeting_idx on content_items (greeting_slot) where kind = 'greeting';

alter table content_items enable row level security;

drop policy if exists "anyone reads enabled content" on content_items;
create policy "anyone reads enabled content" on content_items
  for select using (enabled = true);

-- ── 每日內容（每個 space 每天生成，也是冷卻的歷史來源）──────
-- 03-database.md 的 daily_items。kind 對應到內容：
--   daily_card     ← quote
--   creative_prompt ← prompt
create table if not exists daily_items (
  id       uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,

  local_date date not null,                       -- 以 space 時區計算
  kind text not null check (kind in
    ('daily_card','agent_note','creative_prompt','background_event',
     'theme_suggestion','unfinished_nudge','memory_callback','milestone')),

  title text,
  body  text not null,
  payload jsonb not null default '{}',

  source      text not null check (source in ('pool','generated','activity')),
  source_ref  text,                               -- content_items.content_id 或生成用 model
  content_hash text not null,                      -- 重複控制（v1.0 §24.3）

  status text not null default 'pending'
           check (status in ('pending','delivered','archived')),
  delivered_at timestamptz,
  archived_at  timestamptz,

  created_at timestamptz not null default now(),
  -- ADR-015 冪等：生成重跑不產生重複
  unique (space_id, local_date, kind)
);
create index if not exists daily_items_space_date_idx on daily_items (space_id, local_date desc);
create index if not exists daily_items_space_pending_idx on daily_items (space_id, status) where status = 'pending';
create index if not exists daily_items_space_hash_idx on daily_items (space_id, content_hash, local_date desc);

-- ── 驚喜 ──────────────────────────────────────────────────
create table if not exists surprises (
  id       uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,

  kind   text not null,
  rarity text not null check (rarity in ('common','uncommon','rare','special','anniversary')),
  title  text not null,
  body   text,
  payload jsonb not null default '{}',
  source_ref text,                                -- content_items.content_id

  available_from timestamptz not null default now(),
  expires_at     timestamptz,

  unlocked_at timestamptz,
  favorited   boolean not null default false,

  chain_key   text,
  chain_index integer,

  created_at timestamptz not null default now()
);
create index if not exists surprises_space_unlocked_idx on surprises (space_id, unlocked_at desc nulls first);
create unique index if not exists surprises_chain_uq on surprises (space_id, chain_key, chain_index)
  where chain_key is not null;

alter table daily_items enable row level security;
alter table surprises   enable row level security;

drop policy if exists "member reads daily" on daily_items;
create policy "member reads daily" on daily_items
  for select using (is_space_member(space_id));

drop policy if exists "member updates daily" on daily_items;
create policy "member updates daily" on daily_items
  for update using (is_space_member(space_id)) with check (is_space_member(space_id));

drop policy if exists "member reads surprises" on surprises;
create policy "member reads surprises" on surprises
  for select using (is_space_member(space_id) and available_from <= now());

drop policy if exists "member unlocks surprises" on surprises;
create policy "member unlocks surprises" on surprises
  for update using (is_space_member(space_id)) with check (is_space_member(space_id));

-- 生成走 service role（cron / 開啟時觸發），寫入不開給一般成員。

-- GRANT（0007 的 default privileges 只涵蓋當時的表）
grant select on content_items to authenticated, anon;
grant all    on content_items to service_role;
grant select on daily_items, surprises to authenticated;
grant update on daily_items, surprises to authenticated;
grant all    on daily_items, surprises to service_role;
