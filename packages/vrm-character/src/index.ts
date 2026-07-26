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
export { default as YukirinScene, type YukirinControls, type YukirinMood } from './YukirinScene'
export { default as RikuScene, type RikuControls, type RikuMood } from './RikuScene'
