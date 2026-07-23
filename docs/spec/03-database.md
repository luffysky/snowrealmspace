# 資料庫 — 完整 Schema、索引與 RLS

> 實作 `02-domain-model.md`。
> v1.0 §34 只給了 33 張表的名字與其中 10 張的 DDL，無索引、無外鍵、無 RLS。本檔補齊全部。
> Migration 位置：`supabase/migrations/`

---

## 0. 慣例

| 規則 | 說明 |
|---|---|
| 主鍵 | `uuid primary key default gen_random_uuid()` |
| 時間 | 一律 `timestamptz`，永不用 `timestamp` |
| 租戶鍵 | `space_id uuid not null references spaces(id) on delete cascade` |
| 歸屬 | `created_by uuid references auth.users(id) on delete set null` |
| 列舉 | 用 `text` + `check` 約束，**不用** Postgres enum（enum 增值需要 DDL 鎖表） |
| JSON | 一律 `jsonb`，且必須有 `default '{}'` 或 `'[]'` |
| 軟刪除 | `deleted_at timestamptz`，有此欄的表所有查詢預設帶 `where deleted_at is null` |
| 命名 | 表名複數 snake_case，欄位 snake_case |
| RLS | **每張帶 `space_id` 的表都必須 `enable row level security`** |

### Migration 檔案順序

```
supabase/migrations/
  0001_extensions.sql
  0002_spaces_and_members.sql
  0003_rls_helpers.sql
  0004_assets.sql
  0005_themes_fonts.sql
  0006_backgrounds.sql
  0007_layouts_widgets.sql
  0008_projects_designs.sql
  0009_agent_memory.sql
  0010_events_timeline.sql
  0011_daily_surprise.sql
  0012_notifications.sql
  0013_ai_routing.sql
  0014_jobs_audit_flags.sql
  0015_seed_reference_data.sql
```

---

## 1. 擴充與輔助函式

```sql
-- 0001_extensions.sql
create extension if not exists "pgcrypto";
create extension if not exists "vector";
create extension if not exists "pg_trgm";     -- 名稱模糊搜尋

-- 0003_rls_helpers.sql
-- 所有 RLS policy 都透過這兩個函式，避免每張表重複子查詢且便於日後最佳化。

create or replace function public.is_space_member(target_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from space_members
    where space_id = target_space_id
      and user_id  = auth.uid()
  );
$$;

create or replace function public.is_space_owner(target_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from space_members
    where space_id = target_space_id
      and user_id  = auth.uid()
      and role     = 'owner'
  );
$$;

revoke all on function public.is_space_member(uuid) from public;
revoke all on function public.is_space_owner(uuid)  from public;
grant execute on function public.is_space_member(uuid) to authenticated;
grant execute on function public.is_space_owner(uuid)  to authenticated;
```

> `security definer` 是必要的：`space_members` 自身也有 RLS，若函式以呼叫者權限執行會產生遞迴。`set search_path` 是 `security definer` 函式的必要防護，不可省略。

```sql
-- updated_at 自動維護
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
```

---

## 2. Space 與成員

```sql
-- 0002_spaces_and_members.sql

create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  locale       text not null default 'zh-TW',
  timezone     text not null default 'Asia/Taipei',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table spaces (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  slug             text not null unique,
  description      text,
  active_theme_id  uuid,      -- FK 於 themes 建立後補上
  active_layout_id uuid,
  active_playlist_id uuid,
  privacy          text not null default 'private'
                     check (privacy in ('private','unlisted','public')),
  timezone         text not null default 'Asia/Taipei',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  constraint slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$')
);

create table space_members (
  space_id  uuid not null references spaces(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  role      text not null check (role in ('owner','collaborator','guest')),
  joined_at timestamptz not null default now(),
  primary key (space_id, user_id)
);
create index on space_members (user_id);

-- 邀請（ADR-003：Alpha 期間 sign-up 關閉，只有持有效邀請者可註冊）
create table space_invites (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid references spaces(id) on delete cascade,  -- null = 邀請建立新 space
  email       text not null,
  role        text not null default 'owner' check (role in ('owner','collaborator','guest')),
  token_hash  text not null unique,     -- 只存 hash，明文 token 僅寄出一次
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index on space_invites (email) where accepted_at is null;

-- v1.0 §31 的使用者設定落點
create table space_settings (
  space_id uuid primary key references spaces(id) on delete cascade,

  -- Appearance
  motion_preference   text not null default 'system'
                        check (motion_preference in ('system','full','reduced','none')),
  sound_enabled       boolean not null default false,

  -- Agent（v1.0 §31.2）
  agent_mode          text not null default 'companion'
                        check (agent_mode in ('companion','creative_director','design_reviewer','organizer','focus_partner','quiet')),
  agent_tone          text not null default 'warm',
  agent_proactive     text not null default 'important_only'
                        check (agent_proactive in ('off','important_only','daily','adaptive','custom')),
  agent_visible       boolean not null default true,
  agent_position      text not null default 'bottom_right',

  -- Privacy（v1.0 §31.3、§32.2）—— 全部預設關閉，符合 §5.1
  memory_enabled          boolean not null default false,  -- ADR-014
  ai_analysis_enabled     boolean not null default false,
  activity_tracking       boolean not null default true,   -- 產品運作必需，但可關
  provider_data_enabled   boolean not null default false,
  public_sharing_enabled  boolean not null default false,

  -- Notification（v1.0 §28.4）
  quiet_hours_start   time,
  quiet_hours_end     time,
  daily_enabled       boolean not null default true,

  -- Home
  weather_enabled     boolean not null default false,
  weather_city        text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Agent 外觀（v1.0 §57.3/§57.4 延後，但欄位先預留）
create table agent_profiles (
  space_id        uuid primary key references spaces(id) on delete cascade,
  display_name    text not null default 'Agent',
  avatar_asset_id uuid,          -- FK 於 assets 建立後補
  persona_key     text not null default 'default',
  greeting_style  text not null default 'warm',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
```

### RLS

```sql
alter table profiles       enable row level security;
alter table spaces         enable row level security;
alter table space_members  enable row level security;
alter table space_invites  enable row level security;
alter table space_settings enable row level security;
alter table agent_profiles enable row level security;

create policy "own profile" on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy "member reads space" on spaces
  for select using (is_space_member(id));
create policy "owner writes space" on spaces
  for update using (is_space_owner(id)) with check (is_space_owner(id));
create policy "owner deletes space" on spaces
  for delete using (is_space_owner(id));
-- INSERT 只走 service role（經由邀請流程），不開放給 authenticated

create policy "member reads members" on space_members
  for select using (is_space_member(space_id));
create policy "owner manages members" on space_members
  for all using (is_space_owner(space_id)) with check (is_space_owner(space_id));

create policy "owner reads invites" on space_invites
  for select using (space_id is not null and is_space_owner(space_id));

create policy "member reads settings" on space_settings
  for select using (is_space_member(space_id));
create policy "owner writes settings" on space_settings
  for all using (is_space_owner(space_id)) with check (is_space_owner(space_id));

create policy "member reads agent profile" on agent_profiles
  for select using (is_space_member(space_id));
create policy "owner writes agent profile" on agent_profiles
  for all using (is_space_owner(space_id)) with check (is_space_owner(space_id));
```

> `space_invites` 的 SELECT 只給 owner，且 `token_hash` 不可被讀出——實務上前端不需要讀這張表，驗證走 service role 端點。

---

## 3. Assets

```sql
-- 0004_assets.sql

create table assets (
  id           uuid primary key default gen_random_uuid(),
  space_id     uuid not null references spaces(id) on delete cascade,
  created_by   uuid references auth.users(id) on delete set null,

  kind         text not null check (kind in ('image','video','pdf','audio','font','document')),
  mime_type    text not null,
  bytes        bigint not null check (bytes > 0),
  checksum     text not null,
  storage_key  text not null unique,

  original_filename text,
  width        integer,
  height       integer,
  duration_ms  integer,

  status       text not null default 'pending'
                 check (status in ('pending','ready','failed')),
  failure_reason text,

  -- 本地分析結果（ADR-012），由 asset.analyze_local job 回填
  local_features jsonb not null default '{}',

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,

  -- 同 space 去重（§02 3.1）。僅對未刪除且就緒的 asset 生效。
  constraint assets_bytes_limit check (bytes <= 52428800)   -- 50 MB 硬上限
);

create unique index assets_space_checksum_uq
  on assets (space_id, checksum)
  where deleted_at is null and status = 'ready';

create index on assets (space_id, created_at desc) where deleted_at is null;
create index on assets (space_id, kind)            where deleted_at is null;
create index on assets (status)                    where status = 'pending';
create index on assets (deleted_at)                where deleted_at is not null;

create table asset_renditions (
  id          uuid primary key default gen_random_uuid(),
  asset_id    uuid not null references assets(id) on delete cascade,
  space_id    uuid not null references spaces(id) on delete cascade,

  role        text not null check (role in ('thumbnail','preview','poster','transcode_720','transcode_1080')),
  mime_type   text not null,
  bytes       bigint not null,
  storage_key text not null unique,
  width       integer,
  height      integer,

  created_at  timestamptz not null default now(),
  unique (asset_id, role)
);
create index on asset_renditions (space_id);

-- 補上先前預留的 FK
alter table agent_profiles
  add constraint agent_profiles_avatar_fk
  foreign key (avatar_asset_id) references assets(id) on delete set null;
```

### 配額檢查

配額不是靠應用層自律，而是靠 DB 函式，避免併發上傳繞過檢查：

```sql
create or replace function public.space_storage_bytes(target_space_id uuid)
returns bigint language sql stable as $$
  select coalesce(sum(a.bytes), 0) + coalesce(sum(r.bytes), 0)
  from assets a
  left join asset_renditions r on r.asset_id = a.id
  where a.space_id = target_space_id and a.deleted_at is null;
$$;
```

上傳意圖端點在同一個 transaction 內呼叫此函式並比對 ADR-022 的 5 GB 上限。

### RLS

```sql
alter table assets           enable row level security;
alter table asset_renditions enable row level security;

create policy "member reads assets" on assets
  for select using (is_space_member(space_id) and deleted_at is null);
create policy "member writes assets" on assets
  for insert with check (is_space_member(space_id));
create policy "member updates assets" on assets
  for update using (is_space_member(space_id)) with check (is_space_member(space_id));

create policy "member reads renditions" on asset_renditions
  for select using (is_space_member(space_id));
```

> `asset_renditions` 只開 SELECT。寫入一律 service role（由 worker 產生），使用者不該能偽造衍生檔。

---

## 4. Theme 與 Font

```sql
-- 0005_themes_fonts.sql

create table themes (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references spaces(id) on delete cascade,
  created_by  uuid references auth.users(id) on delete set null,

  name        text not null,
  definition  jsonb not null,              -- ThemeDefinition，見 05-theme-tokens.md
  source      text not null default 'manual'
                check (source in ('manual','from_image','from_mood','imported','preset')),
  source_asset_id uuid references assets(id) on delete set null,

  is_favorite boolean not null default false,
  -- 對比檢查結果（ADR-011），儲存時計算並快取
  a11y_report jsonb not null default '{}',

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  constraint theme_name_len check (char_length(name) between 1 and 80)
);
create index on themes (space_id, updated_at desc) where deleted_at is null;

-- v1.0 §11.6 要求版本但未給 schema
create table theme_versions (
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
create index on theme_versions (theme_id, version desc);

alter table spaces add constraint spaces_active_theme_fk
  foreign key (active_theme_id) references themes(id) on delete set null;

-- 字體為全域參考資料，非 space 所有（ADR-016）
create table fonts (
  id                   uuid primary key default gen_random_uuid(),
  family               text not null,
  slug                 text not null unique,
  category             text not null check (category in ('sans','serif','display','handwriting','mono')),
  supported_languages  text[] not null default '{}',
  weights              integer[] not null default '{}',
  styles               text[] not null default '{normal}',
  preview_text         text,
  file_manifest        jsonb not null default '{}',   -- { "400/latin": "fonts/inter/400/latin.woff2", ... }
  subset_strategy      text not null default 'static'
                         check (subset_strategy in ('static','unicode_range')),
  license_name         text not null,
  license_url          text not null,
  license_file_key     text,                          -- R2 上的 OFL.txt
  attribution_required boolean not null default false,
  enabled              boolean not null default true,
  sort_order           integer not null default 0,
  created_at           timestamptz not null default now()
);

create table font_pairs (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  heading_font_id uuid not null references fonts(id) on delete cascade,
  body_font_id    uuid not null references fonts(id) on delete cascade,
  ui_font_id      uuid not null references fonts(id) on delete cascade,
  mood_tags       text[] not null default '{}',
  sort_order      integer not null default 0,
  enabled         boolean not null default true
);
```

### RLS

```sql
alter table themes         enable row level security;
alter table theme_versions enable row level security;
alter table fonts          enable row level security;
alter table font_pairs     enable row level security;

create policy "member reads themes" on themes
  for select using (is_space_member(space_id) and deleted_at is null);
create policy "member writes themes" on themes
  for all using (is_space_member(space_id)) with check (is_space_member(space_id));

create policy "member reads theme versions" on theme_versions
  for select using (is_space_member(space_id));

-- 字體是公開參考資料，所有登入者可讀，僅 service role 可寫
create policy "anyone reads enabled fonts" on fonts
  for select using (enabled = true);
create policy "anyone reads font pairs" on font_pairs
  for select using (enabled = true);
```

---

## 5. Background

```sql
-- 0006_backgrounds.sql

create table background_items (
  id        uuid primary key default gen_random_uuid(),
  space_id  uuid not null references spaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,

  asset_id  uuid references assets(id) on delete cascade,
  type      text not null check (type in ('image','video','gradient','procedural')),
  name      text,

  fit        text not null default 'cover' check (fit in ('cover','contain','original')),
  position_x numeric not null default 50 check (position_x between 0 and 100),
  position_y numeric not null default 50 check (position_y between 0 and 100),
  zoom       numeric not null default 1   check (zoom between 0.5 and 4),

  blur       numeric not null default 0   check (blur between 0 and 40),
  brightness numeric not null default 1   check (brightness between 0.2 and 2),
  contrast   numeric not null default 1   check (contrast between 0.2 and 2),
  saturation numeric not null default 1   check (saturation between 0 and 2),

  overlay_color   text not null default '#000000',
  overlay_opacity numeric not null default 0 check (overlay_opacity between 0 and 1),

  loop  boolean not null default true,
  muted boolean not null default true,

  gradient_spec jsonb,
  procedural_id text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  -- 型別一致性：圖片/影片必須有 asset；漸層必須有 spec
  constraint bg_source_check check (
    (type in ('image','video')  and asset_id is not null) or
    (type = 'gradient'          and gradient_spec is not null) or
    (type = 'procedural'        and procedural_id is not null)
  ),
  -- ADR-019：影片一律靜音
  constraint bg_video_muted check (type <> 'video' or muted = true)
);
create index on background_items (space_id, created_at desc) where deleted_at is null;
create index on background_items (asset_id);

create table background_playlists (
  id       uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  name     text not null,

  play_mode text not null default 'sequential'
              check (play_mode in ('sequential','random','per_login','daily','hourly','time_of_day','day_of_week','per_project','manual')),
  interval_seconds integer not null default 900 check (interval_seconds between 5 and 86400),
  transition text not null default 'fade'
              check (transition in ('fade','blur_fade','zoom_fade','slide','dissolve','parallax','page_turn','cinematic_wipe','pixel')),
  transition_ms integer not null default 800 check (transition_ms between 0 and 5000),

  schedule jsonb not null default '{}',   -- v1.0 §12.7 時段規則，以 space 時區計算
  is_active boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on background_playlists (space_id) where deleted_at is null;
-- 一個 space 同時只有一個 active playlist
create unique index bg_playlist_one_active
  on background_playlists (space_id) where is_active = true and deleted_at is null;

create table background_playlist_items (
  id           uuid primary key default gen_random_uuid(),
  playlist_id  uuid not null references background_playlists(id) on delete cascade,
  space_id     uuid not null references spaces(id) on delete cascade,
  background_item_id uuid not null references background_items(id) on delete cascade,
  position     integer not null,
  created_at   timestamptz not null default now(),
  unique (playlist_id, background_item_id),
  unique (playlist_id, position) deferrable initially deferred
);
create index on background_playlist_items (playlist_id, position);

alter table spaces add constraint spaces_active_playlist_fk
  foreign key (active_playlist_id) references background_playlists(id) on delete set null;
```

> `unique (playlist_id, position) deferrable initially deferred` 是必要的：拖曳重新排序時會在同一個 transaction 內短暫出現重複 position，deferred 讓約束在 commit 時才檢查。

### RLS

```sql
alter table background_items          enable row level security;
alter table background_playlists      enable row level security;
alter table background_playlist_items enable row level security;

create policy "member manages backgrounds" on background_items
  for all using (is_space_member(space_id)) with check (is_space_member(space_id));
create policy "member manages playlists" on background_playlists
  for all using (is_space_member(space_id)) with check (is_space_member(space_id));
create policy "member manages playlist items" on background_playlist_items
  for all using (is_space_member(space_id)) with check (is_space_member(space_id));
```

---

## 6. Layout 與 Widget

```sql
-- 0007_layouts_widgets.sql

-- Widget 定義為全域參考資料（不是 space 所有）
create table widget_definitions (
  id            text primary key,           -- 'daily_card'、'agent_message'…（非 uuid，便於程式引用）
  name          text not null,
  version       text not null,
  category      text not null,
  description   text,

  default_w integer not null, default_h integer not null,
  min_w     integer not null, min_h     integer not null,
  max_w     integer not null, max_h     integer not null,

  config_schema jsonb not null default '{}',   -- JSON Schema，見 06-widget-contract.md
  permissions   text[] not null default '{}',
  feature_flag  text,                          -- null = 恆啟用
  enabled       boolean not null default true,
  sort_order    integer not null default 0
);

create table layouts (
  id       uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  name     text not null,
  breakpoint_config jsonb not null default '{}',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on layouts (space_id) where deleted_at is null;

create table widget_instances (
  id       uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  layout_id uuid not null references layouts(id) on delete cascade,
  widget_definition_id text not null references widget_definitions(id) on delete restrict,

  -- 每個斷點各有一組座標，見 06-widget-contract.md
  position jsonb not null default '{}',   -- { desktop: {x,y,w,h}, tablet: {...}, mobile: {order} }

  config jsonb not null default '{}',
  hidden boolean not null default false,
  locked boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on widget_instances (layout_id);
create index on widget_instances (space_id);

alter table spaces add constraint spaces_active_layout_fk
  foreign key (active_layout_id) references layouts(id) on delete set null;
```

### RLS

```sql
alter table layouts            enable row level security;
alter table widget_instances   enable row level security;
alter table widget_definitions enable row level security;

create policy "member manages layouts" on layouts
  for all using (is_space_member(space_id)) with check (is_space_member(space_id));
create policy "member manages widgets" on widget_instances
  for all using (is_space_member(space_id)) with check (is_space_member(space_id));
create policy "anyone reads widget defs" on widget_definitions
  for select using (enabled = true);
```

---

## 7. Project 與 Design

```sql
-- 0008_projects_designs.sql

create table projects (
  id       uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,

  name        text not null,
  description text,
  status      text not null default 'idea'
                check (status in ('idea','active','paused','completed','archived')),
  cover_asset_id uuid references assets(id) on delete set null,
  tags        text[] not null default '{}',

  last_activity_at timestamptz not null default now(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on projects (space_id, status, last_activity_at desc) where deleted_at is null;
create index on projects using gin (tags);

create table design_connections (
  id        uuid primary key default gen_random_uuid(),
  space_id  uuid not null references spaces(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,

  provider  text not null check (provider in ('figma','canva','adobe_express','photoshop','other')),
  external_account_id text,
  external_account_label text,

  access_token_encrypted  text,
  refresh_token_encrypted text,
  scopes    text[] not null default '{}',
  expires_at timestamptz,

  status    text not null default 'active'
              check (status in ('active','expired','revoked','error')),
  last_synced_at timestamptz,
  last_error text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (space_id, provider, external_account_id)
);

create table design_files (
  id       uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,

  provider    text not null default 'upload'
                check (provider in ('upload','figma','canva','adobe','other')),
  connection_id uuid references design_connections(id) on delete set null,
  external_id text,

  title       text not null,
  description text,
  source_url  text,               -- 外部連結（非檔案 URL）
  project_id  uuid references projects(id) on delete set null,
  tags        text[] not null default '{}',

  sync_status text not null default 'manual'
                check (sync_status in ('manual','active','paused','error')),
  last_synced_at timestamptz,
  last_error  text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  -- 外部 provider 必須有 connection 與 external_id
  constraint df_external_check check (
    provider = 'upload' or (connection_id is not null and external_id is not null)
  )
);
create index on design_files (space_id, updated_at desc) where deleted_at is null;
create index on design_files (project_id) where deleted_at is null;
create index on design_files using gin (tags);
create unique index on design_files (connection_id, external_id)
  where provider <> 'upload' and deleted_at is null;

create table design_snapshots (
  id             uuid primary key default gen_random_uuid(),
  space_id       uuid not null references spaces(id) on delete cascade,
  design_file_id uuid not null references design_files(id) on delete cascade,

  asset_id       uuid not null references assets(id) on delete restrict,
  document_asset_id uuid references assets(id) on delete set null,
  external_version_id text,

  extracted_features jsonb not null default '{}',   -- 本地分析（ADR-012）
  vision_features    jsonb not null default '{}',   -- Vision 分析，含 confidence
  checksum       text not null,

  created_at     timestamptz not null default now(),
  unique (design_file_id, checksum)
);
create index on design_snapshots (design_file_id, created_at desc);
create index on design_snapshots (space_id);

create table design_insights (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references spaces(id) on delete cascade,
  snapshot_id uuid references design_snapshots(id) on delete cascade,

  kind        text not null,        -- 'analysis' | 'comparison' | 'suggestion'
  -- v1.0 §21.4 的五分類，每筆陳述都必須帶分類與證據
  statements  jsonb not null default '[]',
  /* [{ category: 'fact'|'metric'|'inference'|'suggestion'|'creative',
        text: string,
        evidence: { metric?, value?, sourceIds: string[] },
        confidence: number }] */

  model_used  text,
  created_at  timestamptz not null default now()
);
create index on design_insights (space_id, created_at desc);
create index on design_insights (snapshot_id);

-- Provider webhook 去重（v1.0 §17.5 的 idempotency）
create table provider_webhooks (
  id            uuid primary key default gen_random_uuid(),
  provider      text not null,
  external_event_id text not null,
  connection_id uuid references design_connections(id) on delete cascade,
  payload       jsonb not null,
  signature_ok  boolean not null,
  processed_at  timestamptz,
  received_at   timestamptz not null default now(),
  unique (provider, external_event_id)
);
```

`design_snapshots.asset_id` 用 `on delete restrict` 而非 cascade：這強制執行 `02-domain-model.md` §5.4 的「刪除 asset 前必須檢查引用」——DB 層直接擋下，不靠應用層記得檢查。

### RLS

```sql
alter table projects           enable row level security;
alter table design_connections enable row level security;
alter table design_files       enable row level security;
alter table design_snapshots   enable row level security;
alter table design_insights    enable row level security;
alter table provider_webhooks  enable row level security;   -- 無 policy = 僅 service role

create policy "member manages projects" on projects
  for all using (is_space_member(space_id)) with check (is_space_member(space_id));

-- 連線含 token，僅 owner 可見（§02 6.3）
create policy "owner reads connections" on design_connections
  for select using (is_space_owner(space_id));
create policy "owner manages connections" on design_connections
  for all using (is_space_owner(space_id)) with check (is_space_owner(space_id));

create policy "member manages design files" on design_files
  for all using (is_space_member(space_id)) with check (is_space_member(space_id));
create policy "member reads snapshots" on design_snapshots
  for select using (is_space_member(space_id));
create policy "member reads insights" on design_insights
  for select using (is_space_member(space_id));
```

> 即使 owner 可 SELECT `design_connections`，`access_token_encrypted` 也**不得**經由 API 回傳。API 層必須明確列出欄位，禁止 `select *`。

---

## 8. Agent 與 Memory

```sql
-- 0009_agent_memory.sql

create table agent_threads (
  id       uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,

  title      text,
  mode       text not null default 'companion',
  project_id uuid references projects(id) on delete set null,

  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on agent_threads (space_id, last_message_at desc) where deleted_at is null;

create table agent_messages (
  id        uuid primary key default gen_random_uuid(),
  space_id  uuid not null references spaces(id) on delete cascade,
  thread_id uuid not null references agent_threads(id) on delete cascade,

  role      text not null check (role in ('user','assistant','tool')),
  content   text,
  -- 助理訊息的結構化內容（五分類陳述、tool call、附件引用）
  blocks    jsonb not null default '[]',

  -- 這則訊息使用了哪些 context（可追溯性，v1.0 §5.2）
  context_refs jsonb not null default '{}',

  model_used text,
  provider   text,
  is_free    boolean,
  escalated  boolean not null default false,
  tokens_input  integer,
  tokens_output integer,
  latency_ms integer,
  error      text,

  created_at timestamptz not null default now()
);
create index on agent_messages (thread_id, created_at);
create index on agent_messages (space_id, created_at desc);

-- Agent 執行動作的稽核與復原（v1.0 §21.5、§39.3 的 rollback）
create table agent_actions (
  id         uuid primary key default gen_random_uuid(),
  space_id   uuid not null references spaces(id) on delete cascade,
  message_id uuid references agent_messages(id) on delete set null,

  tool_name  text not null,
  input      jsonb not null,
  output     jsonb,

  status     text not null default 'pending_confirmation'
               check (status in ('pending_confirmation','approved','rejected','executed','failed','rolled_back')),
  requires_confirmation boolean not null default true,
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,

  -- 復原所需的前值快照
  undo_payload jsonb,
  undone_at    timestamptz,

  error      text,
  created_at timestamptz not null default now()
);
create index on agent_actions (space_id, created_at desc);
create index on agent_actions (status) where status = 'pending_confirmation';

create table memories (
  id       uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,

  type    text not null,
  content text not null,

  source_type text not null
                check (source_type in ('user_explicit','agent_summary','activity','integration')),
  source_id   text,
  source_message_id uuid references agent_messages(id) on delete set null,

  confidence  numeric not null default 1 check (confidence between 0 and 1),
  sensitivity text not null default 'normal'
                check (sensitivity in ('normal','private','restricted')),
  approved    boolean not null default false,
  rejected_at timestamptz,

  embedding   vector(768),
  expires_at  timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  -- ADR-014：Agent 產生的記憶不得直接 approved
  constraint memory_approval_check check (
    source_type = 'user_explicit' or approved = false or created_by is not null
  )
);
create index on memories (space_id) where approved = true and deleted_at is null;
create index on memories (space_id, created_at desc) where approved = false and rejected_at is null;
create index on memories using ivfflat (embedding vector_cosine_ops) where approved = true;

create table insights (
  id       uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,

  type      text not null,
  title     text not null,
  statement text not null,
  evidence  jsonb not null default '{}',
  confidence numeric not null check (confidence between 0 and 1),
  visibility text not null default 'private' check (visibility in ('private','shareable')),

  period_start date,
  period_end   date,

  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- 同一週期同類型只產一次
  unique (space_id, type, period_start, period_end)
);
create index on insights (space_id, created_at desc) where deleted_at is null;
```

### RLS

```sql
alter table agent_threads  enable row level security;
alter table agent_messages enable row level security;
alter table agent_actions  enable row level security;
alter table memories       enable row level security;
alter table insights       enable row level security;

create policy "member manages threads" on agent_threads
  for all using (is_space_member(space_id)) with check (is_space_member(space_id));
create policy "member reads messages" on agent_messages
  for select using (is_space_member(space_id));
create policy "member writes messages" on agent_messages
  for insert with check (is_space_member(space_id));

create policy "member reads actions" on agent_actions
  for select using (is_space_member(space_id));
create policy "owner confirms actions" on agent_actions
  for update using (is_space_owner(space_id)) with check (is_space_owner(space_id));

-- 記憶只有 owner 可見（v1.0 §41.2 明列 guest 不可看 memory）
create policy "owner manages memories" on memories
  for all using (is_space_owner(space_id)) with check (is_space_owner(space_id));

create policy "member reads insights" on insights
  for select using (is_space_member(space_id) and deleted_at is null);
create policy "owner manages insights" on insights
  for all using (is_space_owner(space_id)) with check (is_space_owner(space_id));
```

---

## 9. 事件與 Timeline

```sql
-- 0010_events_timeline.sql
-- 實作 ADR-013：activity_events 為唯一事實來源，timeline_events 為投影

create table activity_events (
  id       uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,

  event_type  text not null,
  entity_type text,
  entity_id   uuid,
  properties  jsonb not null default '{}',

  occurred_at timestamptz not null default now(),
  projected_at timestamptz            -- null = 尚未投影到 timeline
);
create index on activity_events (space_id, occurred_at desc);
create index on activity_events (space_id, event_type, occurred_at desc);
create index on activity_events (occurred_at) where projected_at is null;

-- append-only 強制執行
create rule activity_events_no_update as
  on update to activity_events do instead nothing;
create rule activity_events_no_delete as
  on delete to activity_events do instead nothing;

create table timeline_events (
  id       uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  source_event_id uuid references activity_events(id) on delete set null,

  event_type text not null,
  title      text not null,          -- 使用者可編輯
  body       text,
  entity_type text,
  entity_id   uuid,
  cover_asset_id uuid references assets(id) on delete set null,
  project_id  uuid references projects(id) on delete set null,

  visibility text not null default 'private'
               check (visibility in ('private','shareable','hidden')),
  occurred_at timestamptz not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on timeline_events (space_id, occurred_at desc) where deleted_at is null;
create index on timeline_events (project_id) where deleted_at is null;
create index on timeline_events (space_id, event_type);
```

> `activity_events` 的 append-only 用 RULE 強制，不靠自律。帳號刪除時 service role 需先 `drop rule`、清資料、再重建——這個代價換來的是「事件流不可能被竄改」的保證。實務上帳號刪除走 `delete from spaces` cascade，而 CASCADE 不受 RULE 影響。

### RLS

```sql
alter table activity_events enable row level security;
alter table timeline_events enable row level security;

create policy "member reads activity" on activity_events
  for select using (is_space_member(space_id));
-- INSERT 僅 service role

create policy "member reads timeline" on timeline_events
  for select using (
    is_space_member(space_id) and deleted_at is null and visibility <> 'hidden'
  );
create policy "owner manages timeline" on timeline_events
  for all using (is_space_owner(space_id)) with check (is_space_owner(space_id));
```

---

## 10. Daily 與 Surprise

```sql
-- 0011_daily_surprise.sql

create table daily_items (
  id       uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,

  local_date date not null,          -- 以 space 時區計算
  kind text not null check (kind in
    ('daily_card','agent_note','creative_prompt','background_event',
     'theme_suggestion','unfinished_nudge','memory_callback','milestone')),

  title text,
  body  text not null,
  payload jsonb not null default '{}',

  -- 來源可追溯（v1.0 §5.2）
  source      text not null check (source in ('pool','generated','activity')),
  source_ref  text,                  -- 內容池的 id，或生成用的 model
  content_hash text not null,        -- 重複控制（v1.0 §24.3）

  status text not null default 'pending'
           check (status in ('pending','delivered','archived')),
  delivered_at timestamptz,
  archived_at  timestamptz,

  created_at timestamptz not null default now(),
  -- ADR-015 冪等：cron 重跑不產生重複
  unique (space_id, local_date, kind)
);
create index on daily_items (space_id, local_date desc);
create index on daily_items (space_id, status) where status = 'pending';
-- 重複控制查詢用
create index on daily_items (space_id, content_hash, local_date desc);

create table surprises (
  id       uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,

  kind   text not null,
  rarity text not null check (rarity in ('common','uncommon','rare','special','anniversary')),
  title  text not null,
  body   text,
  payload jsonb not null default '{}',
  asset_id uuid references assets(id) on delete set null,

  available_from timestamptz not null default now(),
  expires_at     timestamptz,

  unlocked_at timestamptz,
  favorited   boolean not null default false,

  -- 生日鏈等固定序列
  chain_key   text,
  chain_index integer,

  created_at timestamptz not null default now()
);
create index on surprises (space_id, unlocked_at desc nulls first);
create unique index on surprises (space_id, chain_key, chain_index) where chain_key is not null;
```

### RLS

```sql
alter table daily_items enable row level security;
alter table surprises   enable row level security;

create policy "member reads daily" on daily_items
  for select using (is_space_member(space_id));
create policy "member updates daily" on daily_items
  for update using (is_space_member(space_id)) with check (is_space_member(space_id));

create policy "member reads surprises" on surprises
  for select using (is_space_member(space_id) and available_from <= now());
create policy "member unlocks surprises" on surprises
  for update using (is_space_member(space_id)) with check (is_space_member(space_id));
```

---

## 11. 通知、Job、稽核、Flag

```sql
-- 0012_notifications.sql
create table notifications (
  id       uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,

  category text not null check (category in
    ('sync_success','sync_failed','daily','agent','weekly_recap',
     'milestone','oauth_expired','processing_done','quota')),
  title text not null,
  body  text,
  link  text,
  payload jsonb not null default '{}',

  channel text not null default 'in_app'
            check (channel in ('in_app','email','web_push','mobile_push')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on notifications (user_id, created_at desc) where read_at is null;
create index on notifications (space_id, created_at desc);

-- 0014_jobs_audit_flags.sql
-- pg-boss 自建 pgboss schema；這張表是我們自己的 job 追蹤（給 UI 顯示進度用）
create table job_records (
  id       uuid primary key default gen_random_uuid(),
  space_id uuid references spaces(id) on delete cascade,

  type    text not null,
  status  text not null default 'queued'
            check (status in ('queued','running','completed','failed','cancelled')),
  payload jsonb not null default '{}',
  result  jsonb,

  idempotency_key text unique,
  retry_count integer not null default 0,
  last_error  text,

  created_at   timestamptz not null default now(),
  started_at   timestamptz,
  completed_at timestamptz
);
create index on job_records (space_id, created_at desc);
create index on job_records (status, created_at) where status in ('queued','running');

create table audit_logs (
  id       uuid primary key default gen_random_uuid(),
  space_id uuid references spaces(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_type text not null default 'user' check (actor_type in ('user','agent','system')),

  action      text not null,
  entity_type text,
  entity_id   uuid,
  before      jsonb,
  after       jsonb,

  ip_hash     text,           -- 雜湊，非明文 IP
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index on audit_logs (space_id, created_at desc);
create index on audit_logs (entity_type, entity_id);

create table feature_flags (
  key         text primary key,
  description text,
  enabled     boolean not null default false,
  updated_at  timestamptz not null default now()
);

create table space_feature_overrides (
  space_id uuid not null references spaces(id) on delete cascade,
  key      text not null references feature_flags(key) on delete cascade,
  enabled  boolean not null,
  primary key (space_id, key)
);
```

### RLS

```sql
alter table notifications          enable row level security;
alter table job_records            enable row level security;
alter table audit_logs             enable row level security;
alter table feature_flags          enable row level security;
alter table space_feature_overrides enable row level security;

create policy "own notifications" on notifications
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "member reads jobs" on job_records
  for select using (space_id is not null and is_space_member(space_id));

create policy "owner reads audit" on audit_logs
  for select using (space_id is not null and is_space_owner(space_id));

create policy "anyone reads flags" on feature_flags for select using (true);
create policy "member reads overrides" on space_feature_overrides
  for select using (is_space_member(space_id));
```

---

## 12. 通用 trigger

```sql
-- 對所有有 updated_at 的表套用
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','spaces','space_settings','agent_profiles','assets','themes',
    'background_items','background_playlists','layouts','widget_instances',
    'projects','design_connections','design_files','memories','timeline_events'
  ] loop
    execute format(
      'create trigger %I_touch before update on %I
       for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;
```

---

## 13. 帳號與 Space 刪除

v1.0 §32.3 要求可刪除，但未定義順序。順序錯誤會留下孤兒檔案。

```
DELETE space（owner 觸發，需二次確認 + 輸入 space 名稱）
  1. spaces.deleted_at = now()            ← 立即從 UI 消失
  2. 入列 space.purge job（延遲 7 天）     ← 寬限期，可取消
  3. Job 執行：
     a. 蒐集該 space 所有 assets + asset_renditions 的 storage_key
     b. 批次刪除 R2 物件（1000 個一批，失敗記錄但不中斷）
     c. R2 全部確認刪除後才 delete from spaces where id = ...
        → 所有子表 CASCADE
     d. 寫 audit_log（此筆不含 space_id，保留於全域稽核）

DELETE account
  1. 對該 user 為 owner 的每個 space 執行上述流程（不含 7 天寬限）
  2. delete from profiles
  3. Supabase Auth admin API 刪除 auth.users
```

**R2 先於 DB 的理由：** 若先刪 DB，storage_key 就永遠找不回來，R2 上的檔案變成無法追蹤的孤兒且持續計費。反過來若 R2 刪成功但 DB 刪失敗，重跑 job 即可（刪除不存在的物件是冪等的）。

**匯出後刪除（v1.0 §32.3）：** `POST /api/account/export` 產生 zip（含所有原始檔 + JSON 資料匯出），完成後寄送下載連結（7 天有效），使用者確認下載後才可觸發刪除。

---

## 14. 索引檢查清單

每張表至少要有的索引：

| 模式 | 索引 |
|---|---|
| 列表頁 | `(space_id, created_at desc) where deleted_at is null` |
| 外鍵 | 每個 FK 欄位都要有索引（Postgres 不自動建） |
| 部分查詢 | 狀態過濾用 partial index，例如 `where status = 'pending'` |
| 陣列 | `tags` 用 GIN |
| 向量 | `embedding` 用 ivfflat + `vector_cosine_ops` |
| 文字搜尋 | 名稱欄位用 `gin (name gin_trgm_ops)` |

---

## 15. RLS 測試要求（ADR-017）

每張帶 `space_id` 的表都必須有這四個測試：

```ts
describe('RLS: <table>', () => {
  it('space 成員可讀自己 space 的資料')
  it('space B 的使用者讀不到 space A 的資料')        // ← 最重要
  it('未登入者讀不到任何資料')
  it('非 owner 無法寫入僅 owner 可寫的表')
})
```

`memories` 與 `design_connections` 額外要測：**collaborator 角色也讀不到**。

CI 中若有任何表缺少 RLS policy，`scripts/check-rls.ts` 會列出並讓 build 失敗：

```sql
-- 檢查用查詢
select tablename from pg_tables t
where schemaname = 'public'
  and exists (select 1 from information_schema.columns c
              where c.table_name = t.tablename and c.column_name = 'space_id')
  and not exists (select 1 from pg_policies p where p.tablename = t.tablename);
```
