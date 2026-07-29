-- 0061_space_decorations_pinned.sql
-- 裝飾品「釘選」欄位：預設每個裝飾跟著頁面內容一起上下捲動（pinned=false）；
-- 使用者可把某個裝飾「釘選」在畫面上（pinned=true），固定於視窗不隨捲動移動。
--
-- 兩種座標系共用同一組 x/y（皆為 0..1 比例，API 照舊夾在 0..1）：
--   pinned=true  → 相對視窗（x=視窗寬比例、y=視窗高比例），position:fixed。
--   pinned=false → 相對捲動內容（x=內容寬比例、y=內容 scrollHeight 比例），position:absolute。
-- 參考系不同，值域相同 → DB 不需要額外欄位，只多這個布林旗標。
--
-- 冪等：add column if not exists（migrate 會重跑）。既有列預設 false＝維持原本
-- 「跟著捲動」的新行為；不需要資料回填。
alter table space_decorations
  add column if not exists pinned boolean not null default false;
