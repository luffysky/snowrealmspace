-- 0010_backgrounds.sql
-- ADR-005：background_items 不存位元組，只存「把某個 asset 當背景呈現」的設定。
-- 同一個 asset 可被多個 background_item 引用（白天版 / 夜晚版共用一份檔案）。
-- 見 docs/spec/02-domain-model.md §3.5、03-database.md §5

create table if not exists background_items (
  id         uuid primary key default gen_random_uuid(),
  space_id   uuid not null references spaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,

  asset_id uuid references assets(id) on delete cascade,
  type     text not null check (type in ('image','video','gradient','procedural')),
  name     text,

  fit        text    not null default 'cover' check (fit in ('cover','contain','original')),
  position_x numeric not null default 50 check (position_x between 0 and 100),
  position_y numeric not null default 50 check (position_y between 0 and 100),
  zoom       numeric not null default 1  check (zoom between 0.5 and 4),

  blur       numeric not null default 0 check (blur between 0 and 40),
  brightness numeric not null default 1 check (brightness between 0.2 and 2),
  contrast   numeric not null default 1 check (contrast between 0.2 and 2),
  saturation numeric not null default 1 check (saturation between 0 and 2),

  overlay_color   text    not null default '#000000',
  overlay_opacity numeric not null default 0 check (overlay_opacity between 0 and 1),

  loop  boolean not null default true,
  muted boolean not null default true,

  gradient_spec jsonb,
  procedural_id text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  -- 型別與來源必須一致，否則渲染時才發現就太晚了
  constraint bg_source_check check (
    (type in ('image','video') and asset_id is not null) or
    (type = 'gradient'         and gradient_spec is not null) or
    (type = 'procedural'       and procedural_id is not null)
  ),
  -- ADR-019：影片背景一律靜音，不給使用者選擇
  constraint bg_video_muted check (type <> 'video' or muted = true)
);
create index if not exists bg_items_space_idx
  on background_items (space_id, created_at desc) where deleted_at is null;
create index if not exists bg_items_asset_idx on background_items (asset_id);

create table if not exists background_playlists (
  id       uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  name     text not null,

  play_mode text not null default 'sequential'
    check (play_mode in ('sequential','random','per_login','daily','hourly',
                         'time_of_day','day_of_week','per_project','manual')),
  interval_seconds integer not null default 900
    check (interval_seconds between 5 and 86400),

  transition text not null default 'fade'
    check (transition in ('fade','blur_fade','zoom_fade','slide','dissolve',
                          'parallax','page_turn','cinematic_wipe','pixel')),
  transition_ms integer not null default 800 check (transition_ms between 0 and 5000),

  -- v1.0 §12.7 的時段規則。以 space 時區計算，不是 UTC。
  schedule  jsonb   not null default '{}',
  is_active boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists bg_playlists_space_idx
  on background_playlists (space_id) where deleted_at is null;

-- 一個 space 同時只能有一個播放中的清單
create unique index if not exists bg_playlist_one_active
  on background_playlists (space_id) where is_active = true and deleted_at is null;

create table if not exists background_playlist_items (
  id                 uuid primary key default gen_random_uuid(),
  playlist_id        uuid not null references background_playlists(id) on delete cascade,
  space_id           uuid not null references spaces(id) on delete cascade,
  background_item_id uuid not null references background_items(id) on delete cascade,
  position           integer not null,
  created_at         timestamptz not null default now(),
  unique (playlist_id, background_item_id)
);
create index if not exists bg_playlist_items_idx
  on background_playlist_items (playlist_id, position);

/*
 * position 唯一性用 deferrable：拖曳重排時會在同一個 transaction 內
 * 短暫出現重複 position，deferred 讓約束延到 commit 才檢查。
 * 不能用一般 unique，否則每次重排都要先寫入暫時值再改回來。
 */
alter table background_playlist_items
  drop constraint if exists bg_playlist_position_uq;
alter table background_playlist_items
  add constraint bg_playlist_position_uq unique (playlist_id, position)
  deferrable initially deferred;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'spaces_active_playlist_fk') then
    alter table spaces add constraint spaces_active_playlist_fk
      foreign key (active_playlist_id) references background_playlists(id) on delete set null;
  end if;
end $$;

alter table background_items          enable row level security;
alter table background_playlists      enable row level security;
alter table background_playlist_items enable row level security;

drop policy if exists "member manages backgrounds" on background_items;
create policy "member manages backgrounds" on background_items
  for all using (is_space_member(space_id)) with check (is_space_member(space_id));

drop policy if exists "member manages playlists" on background_playlists;
create policy "member manages playlists" on background_playlists
  for all using (is_space_member(space_id)) with check (is_space_member(space_id));

drop policy if exists "member manages playlist items" on background_playlist_items;
create policy "member manages playlist items" on background_playlist_items
  for all using (is_space_member(space_id)) with check (is_space_member(space_id));

-- Postgres 沒有 `create trigger if not exists`，必須先 drop。
-- 少了這行 migration 就不是冪等的 —— `supabase start` 會先自動套用一次
-- supabase/migrations/，我們的 migrate 腳本再套用一次就會炸。
drop trigger if exists bg_items_touch on background_items;
create trigger bg_items_touch before update on background_items
  for each row execute function public.touch_updated_at();
drop trigger if exists bg_playlists_touch on background_playlists;
create trigger bg_playlists_touch before update on background_playlists
  for each row execute function public.touch_updated_at();
