/**
 * design_snapshot 建立。實作已移至 @snowrealm/design-sync（web 上傳流程與 worker 同步共用單一來源）。
 * 保留匯入路徑 `@/lib/design/snapshots` 不變（design/files 路由沿用）。
 */
export { createSnapshotFromAsset, type SnapshotResult } from '@snowrealm/design-sync'
