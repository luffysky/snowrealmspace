-- 0032 design_snapshots.asset_id 由 ON DELETE RESTRICT 改為 NO ACTION
--
-- 潛在 bug（排查抓到，verify-space-purge 因為沒建 asset 而漏掉）：
--   刪除 space（purge_space / 帳號刪除）會 cascade 刪 spaces 的所有子表，
--   同時包含 assets 與 design_snapshots。但 design_snapshots.asset_id → assets
--   是 ON DELETE RESTRICT——RESTRICT 是**立即**檢查：cascade 刪到某個 assets 列時，
--   引用它的 design_snapshots 還沒被刪，RESTRICT 立刻報 FK 違反 → 整個 purge 失敗。
--   而 purge 是「R2 先於 DB」：檔案已刪、DB 卻刪不掉 → 資料清除權壞掉、半殘狀態。
--
-- 修法：改成 NO ACTION（預設）。NO ACTION 的檢查延到**語句結束**才做，
--   那時同一次 cascade 已把 design_snapshots 一併刪掉，檢查通過。
--   對「直接刪單一 asset」的行為不變（仍會被擋），所以應用層的引用檢查語意保留
--   （02-domain-model.md §5.4：刪 asset 前要檢查引用）——只是不再擋「共同父層的 cascade」。

alter table design_snapshots drop constraint design_snapshots_asset_id_fkey;
alter table design_snapshots
  add constraint design_snapshots_asset_id_fkey
  foreign key (asset_id) references assets(id) on delete no action;
