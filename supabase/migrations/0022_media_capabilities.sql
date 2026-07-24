-- 0022_media_capabilities.sql
-- Luffy 追加的媒體能力（見 90-build-log.md）：
--   1. 單檔上限 50MB → 500MB（ADR-022 偏離）
--   2. 背景影片可選聲音（ADR-019 偏離：移除強制靜音 CHECK）
--   3. 背景音樂：space 可選一段 audio

-- 1) 單檔上限 500MB
alter table assets drop constraint if exists assets_bytes_limit;
alter table assets add constraint assets_bytes_limit check (bytes <= 524288000); -- 500 MB

-- 2) 背景影片不再強制靜音（muted 由使用者決定）
alter table background_items drop constraint if exists bg_video_muted;

-- 3) 背景音樂：space 選擇性加一段 audio（預設關閉、無音樂）
alter table space_settings
  add column if not exists background_audio_asset_id uuid references assets(id) on delete set null;
alter table space_settings
  add column if not exists background_audio_enabled boolean not null default false;
alter table space_settings
  add column if not exists background_audio_volume real not null default 0.5
    check (background_audio_volume >= 0 and background_audio_volume <= 1);
