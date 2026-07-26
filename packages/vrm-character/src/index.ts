/**
 * @snowrealm/vrm-character — 可嵌入的 VRM 角色 SDK。
 *
 * 移植自 insight-engine 的角色功能，抽成零後端、可跨產品的前端套件：
 *  - `VrmWidget`：全站漂浮、可拖曳、雙角色（雪凜／凜空）切換的角色面板。
 *  - `emitVrm` / `onVrm`：情緒/動作/朗讀訊號匯流排，讓對話端與角色解耦。
 *  - 底層場景（`YukirinScene`/`RikuScene`）與動畫/對嘴工具亦可直接取用做客製。
 *
 * 資產慣例：宿主 app 的 `public/` 需提供 `/models/{Yukirin,Riku}.vrm` 與
 * `/animations/idle/*.fbx`（本套件不打包二進位資產）。three.js 只在 client 跑，
 * `VrmWidget` 已用 mounted guard + React.lazy 確保不在 SSR 渲染。
 */
export { VrmWidget } from './VrmWidget'
export { emitVrm, onVrm, type VrmMood, type VrmSignal } from './bus'

// 注意：**不要**在這個 barrel 靜態 re-export YukirinScene/RikuScene。
// 它們靜態 import three.js（~450KB）；一旦 barrel 靜態帶入，任何只想拿 `emitVrm`
// 的消費端（如 AgentChat）都會把 three 拉進首屏 bundle（/agent 曾因此 599KB）。
// VrmWidget 內部用 React.lazy 動態載入場景 → three 只在打開角色時才下載。
// 需要直接用場景的消費端請走子路徑 import（'@snowrealm/vrm-character/scenes'，未來需要再開）。
