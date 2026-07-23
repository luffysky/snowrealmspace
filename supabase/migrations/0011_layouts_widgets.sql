-- 0011_layouts_widgets.sql
-- 見 docs/spec/03-database.md §6、06-widget-contract.md

/*
 * Widget 定義是全域參考資料，不屬於任何 space。
 * id 用 text 而非 uuid：程式碼要能直接引用 'daily_card'，
 * 且 WidgetId union type 就是這些值。
 */
create table if not exists widget_definitions (
  id          text primary key,
  name        text not null,
  version     text not null,
  category    text not null
                check (category in ('daily','creative','agent','project','system','utility')),
  description text,

  default_w integer not null, default_h integer not null,
  min_w     integer not null, min_h     integer not null,
  max_w     integer not null, max_h     integer not null,

  config_schema jsonb  not null default '{}',
  permissions   text[] not null default '{}',
  feature_flag  text,                          -- null = 恆啟用

  enabled    boolean not null default true,
  sort_order integer not null default 0,

  constraint widget_size_sane check (
    min_w <= default_w and default_w <= max_w and
    min_h <= default_h and default_h <= max_h
  )
);

create table if not exists layouts (
  id       uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces(id) on delete cascade,
  name     text not null,

  -- 每個斷點的欄數等設定；預設值見 06-widget-contract.md §1
  breakpoint_config jsonb not null default '{}',

  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists layouts_space_idx
  on layouts (space_id) where deleted_at is null;

create table if not exists widget_instances (
  id        uuid primary key default gen_random_uuid(),
  space_id  uuid not null references spaces(id) on delete cascade,
  layout_id uuid not null references layouts(id) on delete cascade,
  widget_definition_id text not null references widget_definitions(id) on delete restrict,

  /*
   * 三個斷點各自獨立儲存座標：
   *   { desktop: {x,y,w,h}, tablet: {x,y,w,h}, mobile: {order} }
   * 在 desktop 調整位置不影響 tablet —— 這是「儲存多套版面」的前提。
   * mobile 是單欄排序，沒有 x/y/w/h。
   */
  position jsonb not null default '{}',

  config jsonb   not null default '{}',
  hidden boolean not null default false,
  locked boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists widget_instances_layout_idx on widget_instances (layout_id);
create index if not exists widget_instances_space_idx  on widget_instances (space_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'spaces_active_layout_fk') then
    alter table spaces add constraint spaces_active_layout_fk
      foreign key (active_layout_id) references layouts(id) on delete set null;
  end if;
end $$;

alter table layouts            enable row level security;
alter table widget_instances   enable row level security;
alter table widget_definitions enable row level security;

drop policy if exists "member manages layouts" on layouts;
create policy "member manages layouts" on layouts
  for all using (is_space_member(space_id)) with check (is_space_member(space_id));

drop policy if exists "member manages widgets" on widget_instances;
create policy "member manages widgets" on widget_instances
  for all using (is_space_member(space_id)) with check (is_space_member(space_id));

drop policy if exists "anyone reads widget defs" on widget_definitions;
create policy "anyone reads widget defs" on widget_definitions
  for select using (enabled = true);

-- Postgres 沒有 `create trigger if not exists`，必須先 drop。
-- 少了這行 migration 就不是冪等的 —— `supabase start` 會先自動套用一次
-- supabase/migrations/，我們的 migrate 腳本再套用一次就會炸。
drop trigger if exists layouts_touch on layouts;
create trigger layouts_touch before update on layouts
  for each row execute function public.touch_updated_at();
drop trigger if exists widget_instances_touch on widget_instances;
create trigger widget_instances_touch before update on widget_instances
  for each row execute function public.touch_updated_at();
