-- 0002_spaces_and_members.sql
-- 表結構。RLS policy 在 0003（policy 依賴 0003 定義的 helper 函式）。
-- 見 docs/spec/03-database.md §2

create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  locale       text not null default 'zh-TW',
  timezone     text not null default 'Asia/Taipei',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists spaces (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references auth.users(id) on delete cascade,
  name               text not null,
  slug               text not null unique,
  description        text,
  active_theme_id    uuid,   -- FK 於 themes 建立後補（Milestone B）
  active_layout_id   uuid,
  active_playlist_id uuid,
  privacy            text not null default 'private'
                       check (privacy in ('private','unlisted','public')),
  timezone           text not null default 'Asia/Taipei',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  constraint slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  constraint name_len   check (char_length(name) between 1 and 80)
);
create index if not exists spaces_owner_idx on spaces (owner_id) where deleted_at is null;

create table if not exists space_members (
  space_id  uuid not null references spaces(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  role      text not null check (role in ('owner','collaborator','guest')),
  joined_at timestamptz not null default now(),
  primary key (space_id, user_id)
);
create index if not exists space_members_user_idx on space_members (user_id);

-- ADR-003：Alpha 期間 sign-up 關閉，只有持有效邀請者能註冊
create table if not exists space_invites (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid references spaces(id) on delete cascade,  -- null = 邀請建立新 space
  email       text not null,
  role        text not null default 'owner'
                check (role in ('owner','collaborator','guest')),
  token_hash  text not null unique,   -- 只存 hash；明文 token 僅在建立時回傳一次
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists space_invites_email_idx
  on space_invites (lower(email)) where accepted_at is null;

-- v1.0 §31 的使用者設定落點。隱私相關預設全部關閉（§5.1、ADR-014）
create table if not exists space_settings (
  space_id uuid primary key references spaces(id) on delete cascade,

  motion_preference text not null default 'system'
                      check (motion_preference in ('system','full','reduced','none')),
  sound_enabled     boolean not null default false,

  agent_mode      text not null default 'companion'
                    check (agent_mode in ('companion','creative_director','design_reviewer',
                                          'organizer','focus_partner','quiet')),
  agent_tone      text not null default 'warm',
  agent_proactive text not null default 'important_only'
                    check (agent_proactive in ('off','important_only','daily','adaptive','custom')),
  agent_visible   boolean not null default true,
  agent_position  text not null default 'bottom_right',

  memory_enabled         boolean not null default false,  -- ADR-014
  ai_analysis_enabled    boolean not null default false,
  activity_tracking      boolean not null default true,
  provider_data_enabled  boolean not null default false,
  public_sharing_enabled boolean not null default false,

  quiet_hours_start time,
  quiet_hours_end   time,
  daily_enabled     boolean not null default true,

  weather_enabled boolean not null default false,
  weather_city    text,

  surprise_pity_counter integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- v1.0 §57.3/§57.4 延後決定，但欄位先預留（ADR「Deferred」）
create table if not exists agent_profiles (
  space_id        uuid primary key references spaces(id) on delete cascade,
  display_name    text not null default 'Agent',
  avatar_asset_id uuid,   -- FK 於 assets 建立後補（Milestone B）
  persona_key     text not null default 'default',
  greeting_style  text not null default 'warm',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['profiles','spaces','space_settings','agent_profiles'] loop
    if not exists (select 1 from pg_trigger where tgname = t || '_touch') then
      execute format(
        'create trigger %I_touch before update on %I
         for each row execute function public.touch_updated_at()', t, t);
    end if;
  end loop;
end $$;
