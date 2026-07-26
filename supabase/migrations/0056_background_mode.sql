-- 0056_background_mode.sql
-- 深/淺色各自指定一個背景。
--
-- 背景在本專案是播放清單制（background_playlists.is_active）。為了「淺色模式用一個背景、
-- 深色模式用另一個」，這裡在 space 上加兩個直接指標（單一背景，繞過播放清單）；
-- resolver 依目前色模式優先用對應指標，沒設才退回既有播放清單邏輯（完全向後相容）。
--
-- background_items.tone：色調分類（依亮度自動判、可手改），供資源庫分「淺色/深色」兩區。

alter table spaces
  add column if not exists bg_light_item_id uuid references background_items(id) on delete set null,
  add column if not exists bg_dark_item_id  uuid references background_items(id) on delete set null;

alter table background_items
  add column if not exists tone text not null default 'light'
    check (tone in ('light', 'dark'));
