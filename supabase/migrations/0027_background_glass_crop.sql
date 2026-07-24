-- 0027 背景：霧面玻璃 + 非破壞性裁切
--
-- Luffy 要求：Background Studio 要能加霧面玻璃（要不要、多霧、透明度、圓角、玻璃顏色）
-- 與圖片裁切。
--
-- 設計原則：
--   * 霧面玻璃是「疊在背景上的一層毛玻璃面板」——把既有的平面疊色（overlay_*）
--     升級成 backdrop-blur 的玻璃層，四個參數都真的作用在這層。
--   * 裁切是「呈現設定」不是「改位元組」（ADR-005）——只存呈現用的裁切矩形（百分比），
--     asset 位元組永遠不動；同一張圖可以有不同裁切的多個背景。
--   * glass_color / 預設值是「資料」不是「component 寫死顏色」，與既有 overlay_color 同性質。

alter table background_items
  -- 霧面玻璃層
  add column if not exists glass_enabled boolean not null default false,
  add column if not exists glass_blur    numeric not null default 12
    check (glass_blur between 0 and 60),
  add column if not exists glass_opacity numeric not null default 0.3
    check (glass_opacity between 0 and 1),
  add column if not exists glass_radius  numeric not null default 16
    check (glass_radius between 0 and 64),
  add column if not exists glass_color   text    not null default '#ffffff',
  -- 非破壞性裁切矩形（百分比，左上角 + 寬高）。預設 0,0,100,100 = 不裁切。
  add column if not exists crop_x numeric not null default 0   check (crop_x between 0 and 100),
  add column if not exists crop_y numeric not null default 0   check (crop_y between 0 and 100),
  add column if not exists crop_w numeric not null default 100 check (crop_w between 0 and 100),
  add column if not exists crop_h numeric not null default 100 check (crop_h between 0 and 100);

-- 裁切矩形不能超出邊界（起點 + 寬 ≤ 100）
alter table background_items drop constraint if exists bg_crop_bounds;
alter table background_items add constraint bg_crop_bounds
  check (crop_x + crop_w <= 100.0001 and crop_y + crop_h <= 100.0001);
