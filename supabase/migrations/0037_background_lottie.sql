-- 0037 內建 Lottie 向量動畫背景（Luffy 指示，選「內建 CC0 素材」）
--
-- lottie_id 指向 lib/lottie-scenes 的內建動畫（不存位元組，前端 lazy 載入 JSON）。
-- 動畫為本專案自製（CC0 / 專案自有），來源與授權見 lib/lottie-scenes.ts 標頭。
-- 與 procedural/scene 一樣屬「程式生成、非位元組」來源，不違反 ADR-005。

alter table background_items add column if not exists lottie_id text;

-- 擴充 type 白名單：加入 'lottie'
alter table background_items drop constraint if exists background_items_type_check;
alter table background_items add constraint background_items_type_check
  check (type = any (array['image','video','gradient','procedural','lottie']));

-- 來源一致性：lottie 型別必須有 lottie_id（否則渲染時才發現就太晚了）
alter table background_items drop constraint if exists bg_source_check;
alter table background_items add constraint bg_source_check check (
  (type = any (array['image','video']) and asset_id is not null) or
  (type = 'gradient'   and gradient_spec is not null) or
  (type = 'procedural' and procedural_id is not null) or
  (type = 'lottie'     and lottie_id is not null)
);
