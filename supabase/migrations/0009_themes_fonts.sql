-- 0009_themes_fonts.sql
-- 見 docs/spec/03-database.md §4、05-theme-tokens.md

create table if not exists themes (
  id         uuid primary key default gen_random_uuid(),
  space_id   uuid not null references spaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,

  name       text not null,
  definition jsonb not null,           -- ThemeDefinition，見 05-theme-tokens.md §1
  source     text not null default 'manual'
               check (source in ('manual','from_image','from_mood','imported','preset')),
  source_asset_id uuid references assets(id) on delete set null,

  is_favorite boolean not null default false,
  is_preset   boolean not null default false,   -- 內建主題，不可刪除

  -- 對比檢查結果（ADR-011）。儲存時計算並快取，避免每次渲染重算。
  a11y_report jsonb not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint theme_name_len check (char_length(name) between 1 and 80)
);
create index if not exists themes_space_idx
  on themes (space_id, updated_at desc) where deleted_at is null;
create index if not exists themes_space_fav_idx
  on themes (space_id) where is_favorite = true and deleted_at is null;

-- v1.0 §11.6 要求版本但未給 schema
create table if not exists theme_versions (
  id         uuid primary key default gen_random_uuid(),
  theme_id   uuid not null references themes(id) on delete cascade,
  space_id   uuid not null references spaces(id) on delete cascade,
  version    integer not null,
  label      text,
  definition jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (theme_id, version)
);
create index if not exists theme_versions_idx on theme_versions (theme_id, version desc);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'spaces_active_theme_fk') then
    alter table spaces add constraint spaces_active_theme_fk
      foreign key (active_theme_id) references themes(id) on delete set null;
  end if;
end $$;

/*
 * 字體是全域參考資料，不屬於任何 space（ADR-016）。
 * 使用者不可上傳自有字體 —— 無法驗證授權範圍，託管即承擔散布責任。
 */
create table if not exists fonts (
  id                  uuid primary key default gen_random_uuid(),
  family              text not null,
  slug                text not null unique,
  category            text not null
                        check (category in ('sans','serif','display','handwriting','mono')),
  supported_languages text[] not null default '{}',
  weights             integer[] not null default '{}',
  styles              text[] not null default '{normal}',
  preview_text        text,

  -- { "400": { "subsets": [{ "file": "...", "unicodeRange": "U+4E00-4EFF,..." }] } }
  file_manifest       jsonb not null default '{}',
  subset_strategy     text not null default 'static'
                        check (subset_strategy in ('static','unicode_range')),

  license_name         text not null,
  license_url          text not null,
  license_file_key     text,          -- R2 上的 OFL.txt
  attribution_required boolean not null default false,

  -- 用於 fallback metrics 對齊，減少 FOUT 造成的版面位移
  fallback_stack   text,
  ascent_override  text,
  descent_override text,

  enabled    boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists font_pairs (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  heading_font_id uuid not null references fonts(id) on delete cascade,
  body_font_id    uuid not null references fonts(id) on delete cascade,
  ui_font_id      uuid not null references fonts(id) on delete cascade,
  mood_tags       text[] not null default '{}',
  sort_order      integer not null default 0,
  enabled         boolean not null default true
);

alter table themes         enable row level security;
alter table theme_versions enable row level security;
alter table fonts          enable row level security;
alter table font_pairs     enable row level security;

drop policy if exists "member reads themes" on themes;
create policy "member reads themes" on themes
  for select using (is_space_member(space_id) and deleted_at is null);

drop policy if exists "member writes themes" on themes;
create policy "member writes themes" on themes
  for all using (is_space_member(space_id)) with check (is_space_member(space_id));

drop policy if exists "member reads theme versions" on theme_versions;
create policy "member reads theme versions" on theme_versions
  for select using (is_space_member(space_id));

drop policy if exists "member writes theme versions" on theme_versions;
create policy "member writes theme versions" on theme_versions
  for insert with check (is_space_member(space_id));

-- 字體是公開參考資料。所有人可讀啟用中的，寫入僅 service role。
drop policy if exists "anyone reads enabled fonts" on fonts;
create policy "anyone reads enabled fonts" on fonts for select using (enabled = true);

drop policy if exists "anyone reads font pairs" on font_pairs;
create policy "anyone reads font pairs" on font_pairs for select using (enabled = true);

-- Postgres 沒有 `create trigger if not exists`，必須先 drop。
-- 少了這行 migration 就不是冪等的 —— `supabase start` 會先自動套用一次
-- supabase/migrations/，我們的 migrate 腳本再套用一次就會炸。
drop trigger if exists themes_touch on themes;
create trigger themes_touch before update on themes
  for each row execute function public.touch_updated_at();
