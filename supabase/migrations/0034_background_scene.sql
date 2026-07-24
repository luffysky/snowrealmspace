-- 0034 背景疊加場景（Luffy）：任何背景之上都能疊一層內建動態場景（雪/雨/櫻花…）
--
-- scene_id 指向 lib/scenes 的場景（不存位元組，程式即時生成）。
-- scene_density 是密度倍率。獨立的「動態背景」則用既有的 type='procedural' + procedural_id。

alter table background_items
  add column if not exists scene_id text,
  add column if not exists scene_density numeric not null default 1
    check (scene_density between 0.1 and 3);
